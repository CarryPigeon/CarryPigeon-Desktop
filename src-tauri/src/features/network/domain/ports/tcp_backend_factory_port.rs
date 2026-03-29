//! network｜领域端口：tcp_backend_factory_port。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::future::Future;
use std::pin::Pin;

use crate::features::network::domain::ports::tcp_backend_port::TcpBackendPort;

/// TCP backend 工厂 Future 类型。
pub type TcpBackendFactoryFuture<'a> =
    Pin<Box<dyn Future<Output = anyhow::Result<Box<dyn TcpBackendPort>>> + Send + 'a>>;

/// TCP backend 工厂端口（由 DI 层负责 real/mock 策略）。
pub trait TcpBackendFactoryPort: Send + Sync {
    /// 根据 socket 创建 backend 实例。
    fn create_backend<'a>(
        &'a self,
        server_socket: &'a str,
        socket: String,
    ) -> TcpBackendFactoryFuture<'a>;
}
