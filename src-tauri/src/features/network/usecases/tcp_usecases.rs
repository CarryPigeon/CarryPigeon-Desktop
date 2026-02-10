//! network｜用例层：tcp_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。

use anyhow::anyhow;
use std::collections::HashMap;
use std::sync::{Arc, OnceLock};

use tauri::AppHandle;
use tokio::sync::RwLock;

use crate::features::network::data::tcp_real::TcpServiceReal;
#[cfg(debug_assertions)]
use crate::features::network::mock::tcp_mock::{MockTcpMode, MockTcpService};

enum TcpBackend {
    Real(TcpServiceReal),
    #[cfg(debug_assertions)]
    Mock(MockTcpService),
}

impl TcpBackend {
    fn start(&mut self, app: AppHandle, server_socket: String) {
        match self {
            TcpBackend::Real(s) => s.start(app, server_socket),
            #[cfg(debug_assertions)]
            TcpBackend::Mock(s) => s.start(app, server_socket),
        }
    }

    async fn send(&mut self, data: Vec<u8>) -> anyhow::Result<()> {
        match self {
            TcpBackend::Real(s) => s.send(data).await,
            #[cfg(debug_assertions)]
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

/// 初始化全局 TCP service 注册表。
///
/// # 返回值
/// 无返回值。
///
/// # 说明
/// - 该函数为 best-effort：重复调用不产生副作用；
/// - 若未初始化，后续调用 `add_tcp_service/send_tcp_service/listen_tcp_service` 会返回错误。
pub fn init_tcp_service() {
    let _ = TCP_REGISTRY
        .get_or_init(|| Arc::new(RwLock::new(TcpRegistry::default())))
        .clone();
}

#[cfg(debug_assertions)]
fn parse_mock_mode(socket: &str) -> MockTcpMode {
    if socket.starts_with("mock://handshake") {
        return MockTcpMode::HandshakeOk;
    }
    MockTcpMode::NoServer
}

/// 为指定 server_socket 创建并注册一个 TCP backend（real 或 mock）。
///
/// # 参数
/// - `app`：Tauri 应用句柄（用于 emit 收包事件）。
/// - `server_socket`：逻辑 server_socket（作为 registry key）。
/// - `socket`：实际连接地址（可能为 `mock://...`、`tcp://...`、`tls://...` 等）。
///
/// # 返回值
/// - `Ok(())`：创建成功并已写入注册表。
/// - `Err(anyhow::Error)`：创建失败原因（例如未初始化/连接失败等）。
///
/// # 说明
/// - 当真实连接失败时，会降级为 mock backend（ConnectFailed），以保证 UI 可继续工作；
/// - 创建完成后会立即调用 backend.start()（用于注册监听或发送 mock 首包）。
pub async fn add_tcp_service(
    app: AppHandle,
    server_socket: String,
    socket: String,
) -> anyhow::Result<()> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or_else(|| anyhow!("TCP Service not initialized"))?;
    let mut lock = registry.write().await;

    let mut backend = if socket.starts_with("mock://") {
        #[cfg(debug_assertions)]
        {
            TcpBackend::Mock(MockTcpService::new(parse_mock_mode(&socket)))
        }
        #[cfg(not(debug_assertions))]
        {
            return Err(anyhow!(
                "mock:// socket is only supported in debug builds (server_socket={})",
                server_socket
            ));
        }
    } else {
        match TcpServiceReal::connect(socket.clone()).await {
            Ok(real) => TcpBackend::Real(real),
            Err(err) => {
                tracing::warn!(
                    action = if cfg!(debug_assertions) {
                        "network_tcp_connect_failed_fallback_mock"
                    } else {
                        "network_tcp_connect_failed"
                    },
                    socket = %socket,
                    error = %err,
                    "TCP connect failed",
                );
                #[cfg(debug_assertions)]
                {
                    TcpBackend::Mock(MockTcpService::new(MockTcpMode::ConnectFailed))
                }
                #[cfg(not(debug_assertions))]
                {
                    return Err(err);
                }
            }
        }
    };

    backend.start(app, server_socket.clone());
    lock.map.insert(server_socket, backend);
    Ok(())
}

/// 向指定 server_socket 对应的 TCP backend 发送数据。
///
/// # 参数
/// - `server_socket`：逻辑 server_socket（用于查找 backend）。
/// - `data`：要发送的 bytes。
///
/// # 返回值
/// - `Ok(())`：发送成功。
/// - `Err(anyhow::Error)`：发送失败原因。
pub async fn send_tcp_service(server_socket: String, data: Vec<u8>) -> anyhow::Result<()> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or_else(|| anyhow!("TCP Service not initialized"))?;
    let mut lock = registry.write().await;
    let backend = lock
        .map
        .get_mut(&server_socket)
        .ok_or_else(|| anyhow!("TCP service not found for server_socket: {}", server_socket))?;
    backend.send(data).await
}

/// 监听（或重启）指定 server_socket 的 TCP backend。
///
/// # 参数
/// - `server_socket`：逻辑 server_socket（用于查找 backend）。
/// - `app`：Tauri 应用句柄（用于 emit 收包事件）。
///
/// # 返回值
/// - `Ok(())`：启动成功。
/// - `Err(anyhow::Error)`：启动失败原因（例如服务未初始化/找不到 backend）。
///
/// # 说明
/// 当前实现会调用 backend 的 `start`，用于注册监听或发送初始事件（mock）。
pub async fn listen_tcp_service(server_socket: String, app: AppHandle) -> anyhow::Result<()> {
    let registry = TCP_REGISTRY
        .get()
        .cloned()
        .ok_or_else(|| anyhow!("TCP Service not initialized"))?;
    let mut lock = registry.write().await;
    let backend = lock
        .map
        .get_mut(&server_socket)
        .ok_or_else(|| anyhow!("TCP service not found for server_socket: {}", server_socket))?;
    backend.start(app, server_socket);
    Ok(())
}
