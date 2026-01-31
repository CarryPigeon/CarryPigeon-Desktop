use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use tauri::AppHandle;
use tokio::sync::RwLock;

use crate::features::network::data::tcp_real::TcpServiceReal;
use crate::features::network::mock::tcp_mock::{MockTcpMode, MockTcpService};

enum TcpBackend {
    Real(TcpServiceReal),
    Mock(MockTcpService),
}

impl TcpBackend {
    fn start(&mut self, app: AppHandle, server_socket: String) {
        match self {
            TcpBackend::Real(s) => s.start(app, server_socket),
            TcpBackend::Mock(s) => s.start(app, server_socket),
        }
    }

    async fn send(&mut self, data: Vec<u8>) -> anyhow::Result<()> {
        match self {
            TcpBackend::Real(s) => s.send(data).await,
            TcpBackend::Mock(s) => s.send(data).await,
        }
    }
}

#[derive(Default)]
struct TcpRegistry {
    map: HashMap<String, TcpBackend>,
}

type SharedTcpRegistry = Arc<RwLock<TcpRegistry>>;

static TCP_REGISTRY: OnceLock<SharedTcpRegistry> = OnceLock::new();

pub fn init_tcp_service() {
    let _ = TCP_REGISTRY
        .get_or_init(|| Arc::new(RwLock::new(TcpRegistry::default())))
        .clone();
}

fn parse_mock_mode(socket: &str) -> MockTcpMode {
    if socket.starts_with("mock://handshake") {
        return MockTcpMode::HandshakeOk;
    }
    MockTcpMode::NoServer
}

pub async fn add_tcp_service(
    app: AppHandle,
    server_socket: String,
    socket: String,
) -> Result<(), String> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or("TCP Service not initialized")?;
    let mut lock = registry.write().await;

    let mut backend = if socket.starts_with("mock://") {
        TcpBackend::Mock(MockTcpService::new(parse_mock_mode(&socket)))
    } else {
        match TcpServiceReal::connect(socket.clone()).await {
            Ok(real) => TcpBackend::Real(real),
            Err(err) => {
                tracing::warn!(
                    "TCP connect failed; falling back to mock (no-server). socket={}, err={}",
                    socket,
                    err
                );
                TcpBackend::Mock(MockTcpService::new(MockTcpMode::ConnectFailed))
            }
        }
    };

    backend.start(app, server_socket.clone());
    lock.map.insert(server_socket, backend);
    Ok(())
}

pub async fn send_tcp_service(server_socket: String, data: Vec<u8>) -> Result<(), String> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or("TCP Service not initialized")?;
    let mut lock = registry.write().await;
    let backend = lock
        .map
        .get_mut(&server_socket)
        .ok_or_else(|| format!("TCP service not found for server_socket: {}", server_socket))?;
    backend.send(data).await.map_err(|e| e.to_string())
}

pub async fn listen_tcp_service(server_socket: String, app: AppHandle) -> Result<(), String> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or("TCP Service not initialized")?;
    let mut lock = registry.write().await;
    let backend = lock
        .map
        .get_mut(&server_socket)
        .ok_or_else(|| format!("TCP service not found for server_socket: {}", server_socket))?;
    backend.start(app, server_socket);
    Ok(())
}
