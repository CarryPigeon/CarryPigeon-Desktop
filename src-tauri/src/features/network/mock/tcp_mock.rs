use tauri::{AppHandle, Emitter};

use crate::features::network::domain::types::TcpMessageEvent;

#[derive(Debug, Clone, Copy)]
pub enum MockTcpMode {
    /// 模拟“无服务器”：不回包，发送直接报错。
    NoServer,
    /// 模拟“连接失败”：用于真实连接失败时的降级路径，发送直接报错。
    ConnectFailed,
    /// 模拟“仅握手成功”：连接后主动发送 /handshake 响应（用于本地 UI 流程演示）。
    HandshakeOk,
}

pub struct MockTcpService {
    mode: MockTcpMode,
    started: bool,
}

impl MockTcpService {
    pub fn new(mode: MockTcpMode) -> Self {
        Self {
            mode,
            started: false,
        }
    }

    pub fn start(&mut self, app: AppHandle, server_socket: String) {
        if self.started {
            return;
        }
        self.started = true;

        if !matches!(self.mode, MockTcpMode::HandshakeOk) {
            return;
        }

        // 发送一个“明文 JSON”的握手完成通知（按 Netty 2B length-prefix 封帧）。
        // 前端会先尝试 AES 解密失败，然后 fallback 为 UTF-8 明文解析握手。
        tokio::spawn(async move {
            let json =
                r#"{"id":-1,"code":0,"data":{"route":"handshake","data":{"session_id":"1"}}}"#;
            let payload = json.as_bytes();
            let len = payload.len().min(u16::MAX as usize) as u16;
            let mut framed = Vec::with_capacity(2 + len as usize);
            framed.push((len >> 8) as u8);
            framed.push((len & 0xFF) as u8);
            framed.extend_from_slice(&payload[..len as usize]);

            // Legacy raw event (framed).
            if let Err(e) = app.emit(
                "tcp-message",
                TcpMessageEvent {
                    server_socket: server_socket.clone(),
                    payload: framed,
                },
            ) {
                tracing::warn!("Failed to emit mock TCP message: {:?}", e);
            }

            // New deframed event (payload only).
            if let Err(e) = app.emit(
                "tcp-frame",
                TcpMessageEvent {
                    server_socket,
                    payload: payload[..len as usize].to_vec(),
                },
            ) {
                tracing::warn!("Failed to emit mock TCP frame: {:?}", e);
            }
        });
    }

    pub async fn send(&mut self, _data: Vec<u8>) -> anyhow::Result<()> {
        match self.mode {
            MockTcpMode::NoServer => Ok(()),
            MockTcpMode::ConnectFailed => Err(anyhow::anyhow!("Mock TCP: connect failed")),
            MockTcpMode::HandshakeOk => Ok(()),
        }
    }
}
