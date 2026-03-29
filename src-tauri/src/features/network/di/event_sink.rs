//! network｜DI：tcp 事件分发器（Tauri 实现）。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Arc;

use tauri::{AppHandle, Emitter};

use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
use crate::features::network::domain::types::{TcpMessageEvent, TcpStateEvent};

/// 基于 Tauri 事件总线的 TCP 事件分发器。
pub struct TauriTcpEventSink {
    app: AppHandle,
}

impl TauriTcpEventSink {
    /// 创建共享事件分发器实例。
    pub fn shared(app: AppHandle) -> Arc<dyn TcpEventSink> {
        Arc::new(Self { app })
    }
}

impl TcpEventSink for TauriTcpEventSink {
    fn emit_state(&self, event: TcpStateEvent) {
        if let Err(e) = self.app.emit("tcp-state", event) {
            tracing::warn!(action = "network_tcp_emit_state_failed", error = ?e);
        }
    }

    fn emit_message(&self, event: TcpMessageEvent) {
        if let Err(e) = self.app.emit("tcp-message", event) {
            tracing::warn!(action = "network_tcp_emit_message_failed", error = ?e);
        }
    }

    fn emit_frame(&self, event: TcpMessageEvent) {
        if let Err(e) = self.app.emit("tcp-frame", event) {
            tracing::warn!(action = "network_tcp_emit_frame_failed", error = ?e);
        }
    }
}
