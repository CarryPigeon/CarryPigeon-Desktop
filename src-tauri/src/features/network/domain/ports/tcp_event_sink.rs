//! network｜领域端口：tcp_event_sink。
//!
//! 约定：注释中文，日志英文（tracing）。

use crate::features::network::domain::types::{TcpMessageEvent, TcpStateEvent};

/// TCP 事件分发端口（用于将底层连接事件转发到宿主）。
///
/// 说明：
/// - 该端口抽象了“事件投递目标”（Tauri / 测试桩）；
/// - 用例层与数据层仅依赖该端口，不直接依赖框架类型。
pub trait TcpEventSink: Send + Sync {
    /// 投递连接状态事件。
    fn emit_state(&self, event: TcpStateEvent);

    /// 投递原始消息事件（legacy）。
    fn emit_message(&self, event: TcpMessageEvent);

    /// 投递拆包后帧事件。
    fn emit_frame(&self, event: TcpMessageEvent);
}
