//! network｜数据层：tcp_real。
//!
//! 约定：注释中文，日志英文（tracing）。

use sha2::Digest;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::io::{ReadHalf, WriteHalf};
use tokio::net::TcpStream;
use tokio_native_tls::TlsStream;

use crate::features::network::domain::types::TcpMessageEvent;

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

/// 基于 tokio 的真实 TCP service（支持纯 TCP 与 TLS）。
///
/// # 说明
/// - 该类型负责建立连接、读取字节流并向前端广播事件；
/// - 拆包规则由实现内部维护（Netty length-prefix），对外暴露为事件流。
pub struct TcpServiceReal {
    reader: Option<TcpReader>,
    writer: TcpWriter,
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
        })
    }

    /// 启动读取循环：将收到的数据通过 Tauri event 广播给前端。
    pub fn start(&mut self, app: AppHandle, server_socket: String) {
        let Some(mut reader) = self.reader.take() else {
            return;
        };

        tokio::spawn(async move {
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
                    Ok(0) => return,
                    Ok(n) => {
                        let chunk = buffer[..n].to_vec();

                        // Legacy: emit raw TCP chunk.
                        if let Err(e) = app.emit(
                            "tcp-message",
                            TcpMessageEvent {
                                server_socket: server_socket.clone(),
                                payload: chunk.clone(),
                            },
                        ) {
                            tracing::warn!(action = "tcp_emit_message_failed", error = ?e);
                        }

                        // New: deframe and emit payload frames.
                        acc.extend_from_slice(&chunk);
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
                                tracing::warn!(action = "tcp_frame_invalid_length", len);
                                acc.clear();
                                break;
                            }
                            if acc.len() < 2 + len {
                                break;
                            }

                            let payload = acc[2..2 + len].to_vec();
                            acc.drain(0..2 + len);

                            if let Err(e) = app.emit(
                                "tcp-frame",
                                TcpMessageEvent {
                                    server_socket: server_socket.clone(),
                                    payload,
                                },
                            ) {
                                tracing::warn!(action = "tcp_emit_frame_failed", error = ?e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!(action = "tcp_read_failed", error = ?e);
                        break;
                    }
                }
            }
        });
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
}

fn parse_transport(raw: &str) -> (Transport, &str) {
    if let Some(rest) = raw.strip_prefix("tls-fp://") {
        if let Some((fp, addr)) = rest.split_once('@') {
            let fp = normalize_fingerprint(fp);
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

fn normalize_fingerprint(raw: &str) -> String {
    raw.trim()
        .to_ascii_lowercase()
        .chars()
        .filter(|c| c.is_ascii_hexdigit())
        .collect()
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

fn verify_tls_fingerprint_sha256(
    tls: &tokio_native_tls::TlsStream<TcpStream>,
    expected_sha256: &str,
) -> anyhow::Result<()> {
    let expected = normalize_fingerprint(expected_sha256);
    if expected.len() != 64 {
        return Err(anyhow::anyhow!(
            "Invalid TLS fingerprint: expected SHA-256 (64 hex chars), got len={}",
            expected.len()
        ));
    }

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
    let actual = sha256_hex(&der);
    if actual != expected {
        return Err(anyhow::anyhow!(
            "TLS fingerprint mismatch: expected={} actual={}",
            expected,
            actual
        ));
    }
    Ok(())
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
