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
