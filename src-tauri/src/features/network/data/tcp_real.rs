use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::io::{ReadHalf, WriteHalf};
use tokio_native_tls::TlsStream;

use crate::features::network::domain::types::TcpMessageEvent;

enum Transport {
    Plain,
    Tls { insecure: bool },
}

enum TcpReader {
    Plain(ReadHalf<TcpStream>),
    Tls(ReadHalf<TlsStream<TcpStream>>),
}

enum TcpWriter {
    Plain(WriteHalf<TcpStream>),
    Tls(WriteHalf<TlsStream<TcpStream>>),
}

pub struct TcpServiceReal {
    reader: Option<TcpReader>,
    writer: TcpWriter,
}

impl TcpServiceReal {
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
            Transport::Tls { insecure } => {
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
                let (r, w) = tokio::io::split(tls);
                (TcpReader::Tls(r), TcpWriter::Tls(w))
            }
        };

        Ok(Self {
            reader: Some(reader),
            writer,
        })
    }

    pub fn start(&mut self, app: AppHandle, server_socket: String) {
        let Some(mut reader) = self.reader.take() else {
            return;
        };

        tokio::spawn(async move {
            // Netty frame: 2 bytes unsigned short length prefix (Big-Endian),
            // followed by `length` bytes payload.
            //
            // Note: We still emit the raw `tcp-message` event for backward compatibility,
            // but the preferred event is `tcp-frame`, which emits deframed payloads.
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
                            tracing::warn!("Failed to emit TCP message: {:?}", e);
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
                                tracing::warn!("Invalid frame length: {}", len);
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
                                tracing::warn!("Failed to emit TCP frame: {:?}", e);
                            }
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to read from socket; err={:?}", e);
                        break;
                    }
                }
            }
        });
    }

    pub async fn send(&mut self, data: Vec<u8>) -> anyhow::Result<()> {
        let result = match &mut self.writer {
            TcpWriter::Plain(w) => w.write_all(&data).await,
            TcpWriter::Tls(w) => w.write_all(&data).await,
        };
        result.map_err(|e| anyhow::anyhow!("Failed to send TCP data: {}", e))
    }
}

fn parse_transport(raw: &str) -> (Transport, &str) {
    if let Some(rest) = raw.strip_prefix("tls-insecure://") {
        return (Transport::Tls { insecure: true }, rest);
    }
    if let Some(rest) = raw.strip_prefix("tls://") {
        return (Transport::Tls { insecure: false }, rest);
    }
    if let Some(rest) = raw.strip_prefix("tcp://") {
        return (Transport::Plain, rest);
    }
    (Transport::Plain, raw)
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
