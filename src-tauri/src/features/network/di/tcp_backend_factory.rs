//! network｜DI：tcp_backend_factory。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Arc;

use crate::features::network::data::tcp_real::TcpServiceReal;
use crate::features::network::domain::ports::tcp_backend_factory_port::{
    TcpBackendFactoryFuture, TcpBackendFactoryPort,
};
use crate::features::network::domain::ports::tcp_backend_port::{TcpBackendFuture, TcpBackendPort};
use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
#[cfg(debug_assertions)]
use crate::features::network::mock::tcp_mock::{MockTcpMode, MockTcpService};

struct RealTcpBackend {
    inner: TcpServiceReal,
}

impl RealTcpBackend {
    fn new(inner: TcpServiceReal) -> Self {
        Self { inner }
    }
}

impl TcpBackendPort for RealTcpBackend {
    fn start(
        &mut self,
        event_sink: Arc<dyn TcpEventSink>,
        server_socket: String,
        session_id: u64,
    ) -> bool {
        self.inner.start(event_sink, server_socket, session_id)
    }

    fn send<'a>(&'a mut self, data: Vec<u8>) -> TcpBackendFuture<'a, ()> {
        Box::pin(async move { self.inner.send(data).await })
    }

    fn close<'a>(&'a mut self) -> TcpBackendFuture<'a, ()> {
        Box::pin(async move { self.inner.close().await })
    }

    fn is_listening(&self) -> bool {
        self.inner.is_listening()
    }
}

#[cfg(debug_assertions)]
struct MockTcpBackend {
    inner: MockTcpService,
}

#[cfg(debug_assertions)]
impl MockTcpBackend {
    fn new(mode: MockTcpMode) -> Self {
        Self {
            inner: MockTcpService::new(mode),
        }
    }
}

#[cfg(debug_assertions)]
impl TcpBackendPort for MockTcpBackend {
    fn start(
        &mut self,
        event_sink: Arc<dyn TcpEventSink>,
        server_socket: String,
        session_id: u64,
    ) -> bool {
        self.inner.start(event_sink, server_socket, session_id);
        true
    }

    fn send<'a>(&'a mut self, data: Vec<u8>) -> TcpBackendFuture<'a, ()> {
        Box::pin(async move { self.inner.send(data).await })
    }

    fn close<'a>(&'a mut self) -> TcpBackendFuture<'a, ()> {
        Box::pin(async move { self.inner.close().await })
    }

    fn is_listening(&self) -> bool {
        true
    }
}

#[cfg(debug_assertions)]
fn parse_mock_mode(socket: &str) -> MockTcpMode {
    if socket.starts_with("mock://handshake") {
        return MockTcpMode::HandshakeOk;
    }
    MockTcpMode::NoServer
}

/// 默认 TCP backend 工厂（real/mock 策略在此实现）。
#[derive(Debug, Default)]
pub struct DefaultTcpBackendFactory;

impl DefaultTcpBackendFactory {
    /// 返回共享工厂实例（无状态，可复用）。
    pub fn shared() -> Arc<Self> {
        Arc::new(Self)
    }
}

impl TcpBackendFactoryPort for DefaultTcpBackendFactory {
    fn create_backend<'a>(
        &'a self,
        _server_socket: &'a str,
        socket: String,
    ) -> TcpBackendFactoryFuture<'a> {
        Box::pin(async move {
            if socket.starts_with("mock://") {
                #[cfg(debug_assertions)]
                {
                    let backend: Box<dyn TcpBackendPort> =
                        Box::new(MockTcpBackend::new(parse_mock_mode(&socket)));
                    return Ok(backend);
                }
                #[cfg(not(debug_assertions))]
                {
                    return Err(anyhow::anyhow!(
                        "mock:// socket is only supported in debug builds (server_socket={})",
                        _server_socket
                    ));
                }
            }

            match TcpServiceReal::connect(socket.clone()).await {
                Ok(real) => {
                    let backend: Box<dyn TcpBackendPort> = Box::new(RealTcpBackend::new(real));
                    Ok(backend)
                }
                Err(err) => {
                    tracing::warn!(action = "network_tcp_connect_failed", socket = %socket, error = %err, "TCP connect failed");
                    Err(err)
                }
            }
        })
    }
}
