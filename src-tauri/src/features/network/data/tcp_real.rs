//! network｜数据层：tcp_real。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::io::{ReadHalf, WriteHalf};
use tokio::net::TcpStream;
use tokio::task::JoinHandle;
use tokio_native_tls::TlsStream;

use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
use crate::features::network::domain::types::{TcpMessageEvent, TcpStateEvent};
use crate::shared::net::tls_fingerprint::{
    normalize_sha256_fingerprint, verify_der_sha256_fingerprint,
};

enum Transport {
    Plain,
    Tls {
        insecure: bool,
        fingerprint_sha256: Option<String>,
    },
}

enum TcpReader {
    Plain(ReadHalf<TcpStream>),
    Tls(ReadHalf<TlsStream<TcpStream>>),
}

enum TcpWriter {
    Plain(WriteHalf<TcpStream>),
    Tls(WriteHalf<TlsStream<TcpStream>>),
}

fn emit_tcp_state(
    event_sink: &Arc<dyn TcpEventSink>,
    server_socket: &str,
    session_id: u64,
    state: &str,
    error: Option<String>,
) {
    event_sink.emit_state(TcpStateEvent {
        server_socket: server_socket.to_string(),
        session_id,
        state: state.to_string(),
        error,
    });
}

fn emit_legacy_tcp_chunk(
    event_sink: &Arc<dyn TcpEventSink>,
    server_socket: &str,
    payload: Vec<u8>,
) {
    event_sink.emit_message(TcpMessageEvent {
        server_socket: server_socket.to_string(),
        payload,
    });
}

fn emit_tcp_frame_payload(
    event_sink: &Arc<dyn TcpEventSink>,
    server_socket: &str,
    payload: Vec<u8>,
) {
    event_sink.emit_frame(TcpMessageEvent {
        server_socket: server_socket.to_string(),
        payload,
    });
}

fn emit_deframed_payloads(
    event_sink: &Arc<dyn TcpEventSink>,
    server_socket: &str,
    acc: &mut Vec<u8>,
) {
    loop {
        if acc.len() < 2 {
            break;
        }

        let len = u16::from_be_bytes([acc[0], acc[1]]) as usize;
        if len == 0 {
            // Consume header; ignore empty payload.
            acc.drain(0..2);
            continue;
        }
        // Hard limit: 10MB payload.
        if len > 10_000_000 {
            tracing::warn!(action = "network_tcp_frame_invalid_length", len);
            acc.clear();
            break;
        }
        if acc.len() < 2 + len {
            break;
        }

        let payload = acc[2..2 + len].to_vec();
        acc.drain(0..2 + len);
        emit_tcp_frame_payload(event_sink, server_socket, payload);
    }
}

/// 基于 tokio 的真实 TCP service（支持纯 TCP 与 TLS）。
///
/// # 说明
/// - 该类型负责建立连接、读取字节流并向前端广播事件；
/// - 拆包规则由实现内部维护（Netty length-prefix），对外暴露为事件流。
pub struct TcpServiceReal {
    reader: Option<TcpReader>,
    writer: TcpWriter,
    read_task: Option<JoinHandle<()>>,
}

impl TcpServiceReal {
    /// 建立 TCP/TLS 连接并返回 service 实例。
    pub async fn connect(socket: String) -> anyhow::Result<Self> {
        let (transport, addr) = parse_transport(&socket);
        let addr = addr.to_string();

        let stream = TcpStream::connect(addr.clone())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect TCP stream: {}", e))?;

        let (reader, writer) = match transport {
            Transport::Plain => {
                let (r, w) = tokio::io::split(stream);
                (TcpReader::Plain(r), TcpWriter::Plain(w))
            }
            Transport::Tls {
                insecure,
                fingerprint_sha256,
            } => {
                let host = extract_host(&addr)?;
                let mut builder = native_tls::TlsConnector::builder();
                if insecure {
                    builder.danger_accept_invalid_certs(true);
                    builder.danger_accept_invalid_hostnames(true);
                }
                let connector = tokio_native_tls::TlsConnector::from(builder.build()?);
                let tls = connector
                    .connect(&host, stream)
                    .await
                    .map_err(|e| anyhow::anyhow!("TLS handshake failed: {}", e))?;

                if let Some(expected) = fingerprint_sha256.as_deref() {
                    verify_tls_fingerprint_sha256(&tls, expected)?;
                }

                let (r, w) = tokio::io::split(tls);
                (TcpReader::Tls(r), TcpWriter::Tls(w))
            }
        };

        Ok(Self {
            reader: Some(reader),
            writer,
            read_task: None,
        })
    }

    /// 启动读取循环：将收到的数据通过 Tauri event 广播给前端。
    ///
    /// # 返回值
    /// - `true`：读取任务成功启动。
    /// - `false`：当前实例无法再次启动（例如 reader 已被消费）。
    pub fn start(
        &mut self,
        event_sink: Arc<dyn TcpEventSink>,
        server_socket: String,
        session_id: u64,
    ) -> bool {
        // 防御式处理：若存在历史读任务，先中止，确保同一实例最多只有一个读循环。
        if let Some(task) = self.read_task.take() {
            task.abort();
        }

        let Some(mut reader) = self.reader.take() else {
            return false;
        };

        emit_tcp_state(&event_sink, &server_socket, session_id, "connected", None);

        let task = tokio::spawn(async move {
            // Netty frame：2 字节无符号短整型长度前缀（大端），后跟 `length` 字节载荷。
            //
            // 注意：为向后兼容仍会发出原始 `tcp-message` 事件；
            // 推荐使用 `tcp-frame` 事件，它会发出已拆包后的 payload。
            let mut acc: Vec<u8> = Vec::new();
            let mut buffer = vec![0; 4096];
            loop {
                let read_result = match &mut reader {
                    TcpReader::Plain(r) => r.read(&mut buffer).await,
                    TcpReader::Tls(r) => r.read(&mut buffer).await,
                };

                match read_result {
                    Ok(0) => {
                        emit_tcp_state(
                            &event_sink,
                            &server_socket,
                            session_id,
                            "disconnected",
                            None,
                        );
                        return;
                    }
                    Ok(n) => {
                        let chunk = buffer[..n].to_vec();

                        // Legacy: emit raw TCP chunk.
                        emit_legacy_tcp_chunk(&event_sink, &server_socket, chunk.clone());

                        // New: deframe and emit payload frames.
                        acc.extend_from_slice(&chunk);
                        emit_deframed_payloads(&event_sink, &server_socket, &mut acc);
                    }
                    Err(e) => {
                        emit_tcp_state(
                            &event_sink,
                            &server_socket,
                            session_id,
                            "error",
                            Some(format!("{}", e)),
                        );
                        tracing::warn!(action = "network_tcp_read_failed", error = ?e);
                        break;
                    }
                }
            }
        });
        self.read_task = Some(task);
        true
    }

    /// 向已建立的 TCP 连接发送一段 bytes。
    ///
    /// # 参数
    /// - `data`：要发送的数据（已封帧或原始 payload 由上层决定）。
    ///
    /// # 返回值
    /// - `Ok(())`：发送成功。
    /// - `Err(anyhow::Error)`：发送失败原因。
    ///
    /// # 说明
    /// 写入目标取决于连接类型：明文 TCP 或 TLS。
    pub async fn send(&mut self, data: Vec<u8>) -> anyhow::Result<()> {
        let result = match &mut self.writer {
            TcpWriter::Plain(w) => w.write_all(&data).await,
            TcpWriter::Tls(w) => w.write_all(&data).await,
        };
        result.map_err(|e| anyhow::anyhow!("Failed to send TCP data: {}", e))
    }

    /// 主动关闭当前连接并终止读取任务（best-effort）。
    pub async fn close(&mut self) -> anyhow::Result<()> {
        if let Some(task) = self.read_task.take() {
            task.abort();
            let _ = task.await;
        }
        let _ = self.reader.take();
        let result = match &mut self.writer {
            TcpWriter::Plain(w) => w.shutdown().await,
            TcpWriter::Tls(w) => w.shutdown().await,
        };
        result.map_err(|e| anyhow::anyhow!("Failed to shutdown TCP writer: {}", e))
    }

    /// 当前读取任务是否仍在运行。
    pub fn is_listening(&self) -> bool {
        self.read_task
            .as_ref()
            .map(|task| !task.is_finished())
            .unwrap_or(false)
    }
}

fn parse_transport(raw: &str) -> (Transport, &str) {
    if let Some(rest) = raw.strip_prefix("tls-fp://") {
        if let Some((fp, addr)) = rest.split_once('@') {
            let fp = normalize_sha256_fingerprint(fp);
            return (
                Transport::Tls {
                    insecure: true,
                    fingerprint_sha256: Some(fp),
                },
                addr,
            );
        }
        // Invalid format: keep `addr` as-is so connect attempt is deterministic,
        // but force fingerprint verification to fail with a clear error.
        return (
            Transport::Tls {
                insecure: true,
                fingerprint_sha256: Some("".to_string()),
            },
            rest,
        );
    }
    if let Some(rest) = raw.strip_prefix("tls-insecure://") {
        return (
            Transport::Tls {
                insecure: true,
                fingerprint_sha256: None,
            },
            rest,
        );
    }
    if let Some(rest) = raw.strip_prefix("tls://") {
        return (
            Transport::Tls {
                insecure: false,
                fingerprint_sha256: None,
            },
            rest,
        );
    }
    if let Some(rest) = raw.strip_prefix("tcp://") {
        return (Transport::Plain, rest);
    }
    (Transport::Plain, raw)
}

fn verify_tls_fingerprint_sha256(
    tls: &tokio_native_tls::TlsStream<TcpStream>,
    expected_sha256: &str,
) -> anyhow::Result<()> {
    let peer = tls
        .get_ref()
        .peer_certificate()
        .map_err(|e| anyhow::anyhow!("Failed to read peer certificate: {}", e))?;
    let Some(cert) = peer else {
        return Err(anyhow::anyhow!(
            "TLS fingerprint check failed: missing peer certificate"
        ));
    };
    let der = cert
        .to_der()
        .map_err(|e| anyhow::anyhow!("Failed to export peer certificate DER: {}", e))?;
    verify_der_sha256_fingerprint(expected_sha256, &der)
}

fn extract_host(addr: &str) -> anyhow::Result<String> {
    // Supports:
    // - host:port
    // - [ipv6]:port
    // - host (no port) -- uncommon but we handle
    let trimmed = addr.trim();
    if trimmed.is_empty() {
        return Err(anyhow::anyhow!("Missing address"));
    }

    if let Some(rest) = trimmed.strip_prefix('[') {
        if let Some(end) = rest.find(']') {
            return Ok(rest[..end].to_string());
        }
        return Err(anyhow::anyhow!("Invalid IPv6 address format"));
    }

    // Split on last ':' to tolerate IPv6 without brackets? (Not supported here)
    if let Some((host, _port)) = trimmed.rsplit_once(':') {
        return Ok(host.to_string());
    }
    Ok(trimmed.to_string())
}
