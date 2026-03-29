//! network｜领域端口：tcp_backend_port。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;

/// TCP backend 端口 Future 类型。
pub type TcpBackendFuture<'a, T> = Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;

/// TCP backend 端口（real/mock 的统一抽象）。
pub trait TcpBackendPort: Send + Sync {
    /// 启动监听循环或触发 mock 首包。
    fn start(
        &mut self,
        event_sink: Arc<dyn TcpEventSink>,
        server_socket: String,
        session_id: u64,
    ) -> bool;

    /// 发送 bytes。
    fn send<'a>(&'a mut self, data: Vec<u8>) -> TcpBackendFuture<'a, ()>;

    /// 关闭 backend。
    fn close<'a>(&'a mut self) -> TcpBackendFuture<'a, ()>;

    /// 是否已在监听中。
    fn is_listening(&self) -> bool;
}
