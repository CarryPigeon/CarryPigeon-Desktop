//! network｜DI：tcp 事件分发器（Tauri 实现）。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter};

use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
use crate::features::network::domain::types::{TcpMessageEvent, TcpStateEvent};

/// 同状态 TCP 生命周期事件的去重窗口。
///
/// 说明：
/// - 状态变化（connected → disconnected）始终立即投递；
/// - 完全重复的状态事件在 200ms 内只投递一次，避免重连抖动时前端闪烁。
const TCP_STATE_DEDUP_INTERVAL: Duration = Duration::from_millis(200);

/// 基于 Tauri 事件总线的 TCP 事件分发器。
pub struct TauriTcpEventSink {
    app: AppHandle,
    /// 每个 server_socket 最近一次发出的状态事件及其时间戳。
    last_state: Mutex<HashMap<String, (TcpStateEvent, Instant)>>,
}

impl TauriTcpEventSink {
    /// 创建共享事件分发器实例。
    pub fn shared(app: AppHandle) -> Arc<dyn TcpEventSink> {
        Arc::new(Self {
            app,
            last_state: Mutex::new(HashMap::new()),
        })
    }

    /// 判断当前状态事件是否需要投递。
    fn should_emit_state(&self, event: &TcpStateEvent, now: Instant) -> bool {
        let guard = self.last_state.lock().unwrap_or_else(|e| e.into_inner());
        match guard.get(&event.server_socket) {
            None => true,
            Some((prev, ts)) => {
                let same_state = prev.state == event.state && prev.error == event.error;
                let expired = now.duration_since(*ts) >= TCP_STATE_DEDUP_INTERVAL;
                !same_state || expired
            }
        }
    }

    /// 记录已投递的状态事件。
    fn record_state(&self, event: TcpStateEvent, now: Instant) {
        if let Ok(mut guard) = self.last_state.lock() {
            guard.insert(event.server_socket.clone(), (event, now));
        }
    }
}

impl TcpEventSink for TauriTcpEventSink {
    fn emit_state(&self, event: TcpStateEvent) {
        let now = Instant::now();
        if !self.should_emit_state(&event, now) {
            return;
        }
        self.record_state(event.clone(), now);
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
