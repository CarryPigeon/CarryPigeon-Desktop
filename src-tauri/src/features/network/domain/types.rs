//! network｜领域层：types。
//!
//! 约定：注释中文，日志英文（tracing）。

use serde::Serialize;

/// 前端事件总线的 TCP 消息事件载荷。
///
/// # 说明
/// - 该结构会被序列化并通过 Tauri event 发送到前端；
/// - `payload` 为原始字节流，具体拆包/协议解析由上层处理。
#[derive(Clone, Debug, Serialize)]
pub struct TcpMessageEvent {
    /// 服务器 socket 地址（用于前端按 server scope 归因）。
    pub server_socket: String,
    /// 原始 TCP 字节载荷。
    pub payload: Vec<u8>,
}

/// 前端事件总线的 TCP 连接生命周期事件载荷。
///
/// # 说明
/// - `state`：连接状态（connected/disconnected/error）；
/// - `error`：当状态为 error 时附带错误摘要（可选）。
#[derive(Clone, Debug, Serialize)]
pub struct TcpStateEvent {
    /// 服务器 socket 地址（用于前端按 server scope 归因）。
    pub server_socket: String,
    /// TCP 会话代际 id（同一 server_socket 下每次 add/reconnect 都会递增）。
    pub session_id: u64,
    /// 连接状态。
    pub state: String,
    /// 错误摘要（仅在 error 状态下可选）。
    pub error: Option<String>,
}
