//! network｜用例层：tcp_usecases。
//!
//! 约定：注释中文，日志英文（tracing）。

use anyhow::anyhow;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};

use tokio::sync::{Mutex, RwLock};

use crate::features::network::domain::ports::tcp_backend_factory_port::TcpBackendFactoryPort;
use crate::features::network::domain::ports::tcp_backend_port::TcpBackendPort;
use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
use crate::features::network::domain::types::TcpStateEvent;
use crate::shared::error::command_error;

type SharedTcpBackend = Arc<Mutex<Box<dyn TcpBackendPort>>>;

const TCP_SCOPE_REJECTION_CODE: &str = "NETWORK_TCP_SCOPE_REJECTED";
const TCP_SCOPE_MISSING_SERVER_SOCKET: &str = "Missing server socket.";
const TCP_SCOPE_MISSING_SOCKET: &str = "Missing socket.";
const TCP_SCOPE_MOCK_RELEASE_REJECTION: &str = "mock:// socket is only supported in debug builds.";

struct TcpEntry {
    backend: SharedTcpBackend,
    session_id: u64,
}

#[derive(Default)]
struct TcpRegistry {
    map: HashMap<String, TcpEntry>,
}

type SharedTcpRegistry = Arc<RwLock<TcpRegistry>>;

async fn close_backend_best_effort(backend: &SharedTcpBackend) {
    if let Ok(mut previous) = backend.try_lock() {
        let _ = previous.close().await;
        return;
    }
    let mut previous = backend.lock().await;
    let _ = previous.close().await;
}

fn emit_disconnected_event(
    event_sink: &Arc<dyn TcpEventSink>,
    server_socket: String,
    session_id: u64,
) {
    event_sink.emit_state(TcpStateEvent {
        server_socket,
        session_id,
        state: "disconnected".to_string(),
        error: None,
    });
}

fn tcp_scope_error(message: impl Into<String>) -> anyhow::Error {
    anyhow!(command_error(TCP_SCOPE_REJECTION_CODE, message))
}

fn normalize_server_socket(server_socket: String) -> anyhow::Result<String> {
    let socket = server_socket.trim();
    if socket.is_empty() {
        return Err(tcp_scope_error(TCP_SCOPE_MISSING_SERVER_SOCKET));
    }
    Ok(socket.to_string())
}

fn normalize_transport_socket(socket: String, allow_mock: bool) -> anyhow::Result<String> {
    let socket = socket.trim();
    if socket.is_empty() {
        return Err(tcp_scope_error(TCP_SCOPE_MISSING_SOCKET));
    }

    let lower = socket.to_ascii_lowercase();
    if lower.starts_with("mock://") {
        return if allow_mock {
            Ok(socket.to_string())
        } else {
            Err(tcp_scope_error(TCP_SCOPE_MOCK_RELEASE_REJECTION))
        };
    }

    if lower.starts_with("tcp://")
        || lower.starts_with("tls://")
        || lower.starts_with("tls-insecure://")
        || lower.starts_with("tls-fp://")
    {
        return Ok(socket.to_string());
    }

    let scheme = socket
        .split_once("://")
        .map(|(scheme, _)| scheme)
        .unwrap_or("<missing>");
    Err(tcp_scope_error(format!("Unsupported socket scheme: {}", scheme)))
}

fn registered_backend_not_found(server_socket: &str) -> anyhow::Error {
    tcp_scope_error(format!("TCP service not found for server_socket: {}", server_socket))
}

/// TCP 注册表服务（可注入状态对象）。
#[derive(Clone)]
pub struct TcpRegistryService {
    registry: SharedTcpRegistry,
    next_session_id: Arc<AtomicU64>,
}

impl Default for TcpRegistryService {
    fn default() -> Self {
        Self::new()
    }
}

impl TcpRegistryService {
    /// 创建 TCP 注册表服务实例。
    pub fn new() -> Self {
        Self {
            registry: Arc::new(RwLock::new(TcpRegistry::default())),
            next_session_id: Arc::new(AtomicU64::new(1)),
        }
    }

    /// 为指定 server_socket 创建并注册一个 TCP backend（real 或 mock）。
    ///
    /// # 参数
    /// - `backend_factory`：backend 工厂端口（由 DI 注入，负责 real/mock 策略）。
    /// - `event_sink`：事件分发端口。
    /// - `server_socket`：逻辑 server_socket（作为 registry key）。
    /// - `socket`：实际连接地址（可能为 `mock://...`、`tcp://...`、`tls://...` 等）。
    ///
    /// # 返回值
    /// - `Ok(())`：创建成功并已写入注册表。
    /// - `Err(anyhow::Error)`：创建失败原因。
    pub async fn add_tcp_service(
        &self,
        backend_factory: Arc<dyn TcpBackendFactoryPort>,
        event_sink: Arc<dyn TcpEventSink>,
        server_socket: String,
        socket: String,
    ) -> anyhow::Result<()> {
        let server_socket = normalize_server_socket(server_socket)?;
        let socket = normalize_transport_socket(socket, cfg!(debug_assertions))?;
        let session_id = self.next_session_id.fetch_add(1, Ordering::Relaxed);
        let mut backend = backend_factory
            .create_backend(&server_socket, socket)
            .await?;

        if !backend.start(Arc::clone(&event_sink), server_socket.clone(), session_id) {
            return Err(anyhow!(
                "TCP service cannot start listening for server_socket: {}",
                server_socket
            ));
        }

        let backend = Arc::new(Mutex::new(backend));
        let mut lock = self.registry.write().await;
        let replaced = lock.map.insert(
            server_socket.clone(),
            TcpEntry {
                backend: Arc::clone(&backend),
                session_id,
            },
        );
        drop(lock);

        if let Some(old) = replaced {
            close_backend_best_effort(&old.backend).await;
            emit_disconnected_event(&event_sink, server_socket, old.session_id);
        }
        Ok(())
    }

    /// 向指定 server_socket 对应的 TCP backend 发送数据。
    pub async fn send_tcp_service(
        &self,
        server_socket: String,
        data: Vec<u8>,
    ) -> anyhow::Result<()> {
        let server_socket = normalize_server_socket(server_socket)?;
        let backend = {
            let lock = self.registry.read().await;
            lock.map
                .get(&server_socket)
                .map(|entry| Arc::clone(&entry.backend))
        }
        .ok_or_else(|| registered_backend_not_found(&server_socket))?;
        let mut backend = backend.lock().await;
        backend.send(data).await
    }

    /// 移除并关闭指定 server_socket 的 TCP backend。
    pub async fn remove_tcp_service(
        &self,
        server_socket: String,
        event_sink: Arc<dyn TcpEventSink>,
    ) -> anyhow::Result<()> {
        let server_socket = normalize_server_socket(server_socket)?;
        let entry = {
            let mut lock = self.registry.write().await;
            lock.map.remove(&server_socket)
        }
        .ok_or_else(|| registered_backend_not_found(&server_socket))?;
        let mut backend = entry.backend.lock().await;
        let close_error = backend.close().await.err();
        emit_disconnected_event(&event_sink, server_socket.clone(), entry.session_id);
        if let Some(error) = close_error {
            return Err(error);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::network::domain::ports::tcp_backend_factory_port::{
        TcpBackendFactoryFuture, TcpBackendFactoryPort,
    };
    use crate::features::network::domain::ports::tcp_backend_port::{TcpBackendFuture, TcpBackendPort};
    use crate::features::network::domain::ports::tcp_event_sink::TcpEventSink;
    use crate::features::network::domain::types::{TcpMessageEvent, TcpStateEvent};
    use std::sync::Mutex as StdMutex;

    #[derive(Default)]
    struct TestBackendState {
        start_calls: usize,
        sent_payloads: Vec<Vec<u8>>,
        close_calls: usize,
    }

    struct TestBackend {
        state: Arc<StdMutex<TestBackendState>>,
    }

    impl TcpBackendPort for TestBackend {
        fn start(
            &mut self,
            _event_sink: Arc<dyn TcpEventSink>,
            _server_socket: String,
            _session_id: u64,
        ) -> bool {
            let mut state = self.state.lock().expect("test backend state poisoned");
            state.start_calls += 1;
            true
        }

        fn send<'a>(&'a mut self, data: Vec<u8>) -> TcpBackendFuture<'a, ()> {
            let state = Arc::clone(&self.state);
            Box::pin(async move {
                state
                    .lock()
                    .expect("test backend state poisoned")
                    .sent_payloads
                    .push(data);
                Ok(())
            })
        }

        fn close<'a>(&'a mut self) -> TcpBackendFuture<'a, ()> {
            let state = Arc::clone(&self.state);
            Box::pin(async move {
                state.lock().expect("test backend state poisoned").close_calls += 1;
                Ok(())
            })
        }

        fn is_listening(&self) -> bool {
            true
        }
    }

    struct TestBackendFactory {
        state: Arc<StdMutex<TestBackendState>>,
    }

    impl TcpBackendFactoryPort for TestBackendFactory {
        fn create_backend<'a>(
            &'a self,
            _server_socket: &'a str,
            _socket: String,
        ) -> TcpBackendFactoryFuture<'a> {
            let state = Arc::clone(&self.state);
            Box::pin(async move { Ok(Box::new(TestBackend { state }) as Box<dyn TcpBackendPort>) })
        }
    }

    #[derive(Default)]
    struct TestEventSink {
        states: Arc<StdMutex<Vec<TcpStateEvent>>>,
        messages: Arc<StdMutex<Vec<TcpMessageEvent>>>,
        frames: Arc<StdMutex<Vec<TcpMessageEvent>>>,
    }

    impl TcpEventSink for TestEventSink {
        fn emit_state(&self, event: TcpStateEvent) {
            self.states.lock().expect("test sink state poisoned").push(event);
        }

        fn emit_message(&self, event: TcpMessageEvent) {
            self.messages.lock().expect("test sink state poisoned").push(event);
        }

        fn emit_frame(&self, event: TcpMessageEvent) {
            self.frames.lock().expect("test sink state poisoned").push(event);
        }
    }

    #[tokio::test]
    async fn tcp_registered_server_workspace_operations_succeed() {
        let service = TcpRegistryService::new();
        let backend_state = Arc::new(StdMutex::new(TestBackendState::default()));
        let factory = Arc::new(TestBackendFactory {
            state: Arc::clone(&backend_state),
        });
        let event_sink: Arc<dyn TcpEventSink> = Arc::new(TestEventSink::default());

        service
            .add_tcp_service(
                factory,
                Arc::clone(&event_sink),
                "socket://server-a".to_string(),
                "tcp://127.0.0.1:9000".to_string(),
            )
            .await
            .expect("registered service should add");

        service
            .send_tcp_service("socket://server-a".to_string(), vec![1, 2, 3])
            .await
            .expect("registered service should send");

        service
            .remove_tcp_service("socket://server-a".to_string(), event_sink)
            .await
            .expect("registered service should remove");

        let state = backend_state.lock().expect("test backend state poisoned");
        assert_eq!(state.start_calls, 1);
        assert_eq!(state.sent_payloads, vec![vec![1, 2, 3]]);
        assert_eq!(state.close_calls, 1);
        println!("PASS tcp_registered_server_workspace_operations_succeed");
    }

    #[tokio::test]
    async fn tcp_rejects_unregistered_workspace_socket() {
        let service = TcpRegistryService::new();

        let send_err = service
            .send_tcp_service("socket://missing".to_string(), vec![9])
            .await
            .expect_err("unregistered send should fail");
        println!("send error: {}", send_err);
        assert_eq!(send_err.to_string(), "[NETWORK_TCP_SCOPE_REJECTED] TCP service not found for server_socket: socket://missing");

        let remove_err = service
            .remove_tcp_service("socket://missing".to_string(), Arc::new(TestEventSink::default()))
            .await
            .expect_err("unregistered remove should fail");
        println!("remove error: {}", remove_err);
        assert_eq!(remove_err.to_string(), "[NETWORK_TCP_SCOPE_REJECTED] TCP service not found for server_socket: socket://missing");
    }

    #[test]
    fn tcp_rejects_mock_socket_outside_debug_builds() {
        let err = normalize_transport_socket("mock://handshake".to_string(), false)
            .expect_err("mock socket should be rejected when debug transport is disabled");
        println!("mock validation error: {}", err);
        assert_eq!(err.to_string(), "[NETWORK_TCP_SCOPE_REJECTED] mock:// socket is only supported in debug builds.");
    }

    #[test]
    fn tcp_rejects_empty_transport_socket() {
        let err = normalize_transport_socket("   ".to_string(), true)
            .expect_err("empty transport socket should be rejected");
        println!("empty transport socket error: {}", err);
        assert_eq!(err.to_string(), "[NETWORK_TCP_SCOPE_REJECTED] Missing socket.");
    }
}
