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

type SharedTcpBackend = Arc<Mutex<Box<dyn TcpBackendPort>>>;

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
        let backend = {
            let lock = self.registry.read().await;
            lock.map
                .get(&server_socket)
                .map(|entry| Arc::clone(&entry.backend))
        }
        .ok_or_else(|| anyhow!("TCP service not found for server_socket: {}", server_socket))?;
        let mut backend = backend.lock().await;
        backend.send(data).await
    }

    /// 移除并关闭指定 server_socket 的 TCP backend。
    pub async fn remove_tcp_service(
        &self,
        server_socket: String,
        event_sink: Arc<dyn TcpEventSink>,
    ) -> anyhow::Result<()> {
        let entry = {
            let mut lock = self.registry.write().await;
            lock.map.remove(&server_socket)
        }
        .ok_or_else(|| anyhow!("TCP service not found for server_socket: {}", server_socket))?;
        let mut backend = entry.backend.lock().await;
        let close_error = backend.close().await.err();
        emit_disconnected_event(&event_sink, server_socket.clone(), entry.session_id);
        if let Some(error) = close_error {
            return Err(error);
        }
        Ok(())
    }
}
