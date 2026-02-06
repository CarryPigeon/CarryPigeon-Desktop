//! network｜Mock：tcp_mock。
//!
//! 约定：注释中文，日志英文（tracing）。

use tauri::{AppHandle, Emitter};

use crate::features::network::domain::types::TcpMessageEvent;

/// Mock TCP 的运行模式。
///
/// # 说明
/// 该枚举用于在没有真实服务端的情况下演示 UI 流程或覆盖降级路径。
#[derive(Debug, Clone, Copy)]
pub enum MockTcpMode {
    /// 模拟“无服务器”：不回包，发送直接报错。
    NoServer,
    /// 模拟“连接失败”：用于真实连接失败时的降级路径，发送直接报错。
    ConnectFailed,
    /// 模拟“仅握手成功”：连接后主动发送 /handshake 响应（用于本地 UI 流程演示）。
    HandshakeOk,
}

/// Mock TCP 服务实现（仅覆盖最小必要行为）。
///
/// # 说明
/// - `start` 用于“模拟建立连接后的首包事件”（例如握手成功）；
/// - `send` 仅用于让上层调用链可用（不同 mode 返回不同结果）。
pub struct MockTcpService {
    mode: MockTcpMode,
    started: bool,
}

impl MockTcpService {
    /// 创建一个新的 Mock TCP 服务实例。
    ///
    /// # 参数
    /// - `mode`：MockTcpMode
    ///
    /// # 返回值
    /// 返回服务实例。
    pub fn new(mode: MockTcpMode) -> Self {
        Self {
            mode,
            started: false,
        }
    }

    /// 启动 mock 服务，并按 mode 发送必要的模拟事件。
    ///
    /// # 参数
    /// - `app`：Tauri 应用句柄，用于向前端 emit 事件。
    /// - `server_socket`：逻辑 server_socket（事件中透传给前端用于路由）。
    ///
    /// # 返回值
    /// 无返回值。
    ///
    /// # 说明
    /// - 该函数是幂等的：重复调用不会重复发送事件；
    /// - 当前仅 `HandshakeOk` 会发送握手完成事件，其它模式不发事件。
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

            // 旧事件（带 length-prefix 封帧后的 raw bytes）。
            if let Err(e) = app.emit(
                "tcp-message",
                TcpMessageEvent {
                    server_socket: server_socket.clone(),
                    payload: framed,
                },
            ) {
                tracing::warn!(action = "tcp_mock_emit_message_failed", error = ?e);
            }

            // 新事件（仅 payload，去掉 length-prefix；由 Rust 侧 deframe 后统一投递）。
            if let Err(e) = app.emit(
                "tcp-frame",
                TcpMessageEvent {
                    server_socket,
                    payload: payload[..len as usize].to_vec(),
                },
            ) {
                tracing::warn!(action = "tcp_mock_emit_frame_failed", error = ?e);
            }
        });
    }

    /// 发送一段 TCP bytes（mock 实现）。
    ///
    /// # 参数
    /// - `_data`：要发送的数据（mock 不使用）。
    ///
    /// # 返回值
    /// - `Ok(())`：发送成功（或被忽略）。
    /// - `Err(anyhow::Error)`：模拟发送失败原因。
    pub async fn send(&mut self, _data: Vec<u8>) -> anyhow::Result<()> {
        match self.mode {
            MockTcpMode::NoServer => Ok(()),
            MockTcpMode::ConnectFailed => Err(anyhow::anyhow!("Mock TCP: connect failed")),
            MockTcpMode::HandshakeOk => Ok(()),
        }
    }
}
