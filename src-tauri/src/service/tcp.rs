use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::RwLock;

#[derive(Clone, Debug, Serialize)]
pub struct TcpMessageEvent {
    pub server_socket: String,
    pub payload: Vec<u8>,
}

pub struct TcpService {
    reader: Option<tokio::net::tcp::OwnedReadHalf>,
    writer: tokio::net::tcp::OwnedWriteHalf,
}

#[derive(Default)]
pub struct TcpMapService {
    map: HashMap<String, Box<TcpService>>,
}

type SharedTcpMapService = Arc<RwLock<TcpMapService>>;
pub static TCP_SERVICE: OnceLock<SharedTcpMapService> = OnceLock::new();

impl TcpService {
    pub async fn new(socket: String) -> anyhow::Result<Self> {
        let stream = TcpStream::connect(socket)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect TCP stream: {}", e))?;
        
        let (reader, writer) = stream.into_split();

        Ok(TcpService { reader: Some(reader), writer })
    }

    pub async fn start(&mut self, app: AppHandle, server_socket: String) {
        if let Some(mut reader) = self.reader.take() {
            tokio::spawn(async move {
                let mut buffer = vec![0; 4096];
                loop {
                    match reader.read(&mut buffer).await {
                        Ok(0) => {
                            return;
                        }
                        Ok(n) => {
                            let res = buffer[..n].to_vec();
                            let event = TcpMessageEvent {
                                server_socket: server_socket.clone(),
                                payload: res,
                            };
                            if let Err(e) = app.emit("tcp-message", event) {
                                tracing::warn!("Failed to emit TCP message: {:?}", e);
                            }
                        },
                        Err(e) => {
                            tracing::warn!(
                                "Failed to read from socket; err={:?}",
                                e
                            );
                            break;
                        }
                    }
                }
            });
        }
    }

    pub async fn send(&mut self, data: Vec<u8>) -> anyhow::Result<()> {
        self.writer
            .write_all(&data)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send TCP data: {}", e))
    }
}

impl TcpMapService {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, server_socket: String, service: Box<TcpService>) {
        // 如果已存在相同 channel_id 的连接，先记录日志
        if self.map.contains_key(&server_socket) {
            tracing::info!(
                "Replacing existing TCP service for channel_id: {}",
                server_socket
            );
        }
        self.map.insert(server_socket, service);
    }

    pub async fn send_with_server(
        &mut self,
        server_socket: String,
        data: Vec<u8>,
    ) -> anyhow::Result<()> {
        match self.map.get_mut(&server_socket) {
            Some(service) => service.send(data).await,
            None => Err(anyhow::anyhow!(
                "TCP service not found for channel_id: {}",
                server_socket
            )),
        }
    }

    pub async fn listen(&mut self, server_socket: String, app: AppHandle) -> anyhow::Result<()> {
        match self.map.get_mut(&server_socket) {
            Some(service) => {
                service.start(app, server_socket.clone()).await;
                Ok(())
            }
            None => Err(anyhow::anyhow!(
                "TCP service not found for channel_id: {}",
                server_socket
            )),
        }
    }

    pub fn remove(&mut self, server_socket: String) -> bool {
        self.map.remove(&server_socket).is_some()
    }

    pub fn contains(&self, server_socket: String) -> bool {
        self.map.contains_key(&server_socket)
    }
}

// 初始化全局TCP服务
pub fn init_tcp_service() -> SharedTcpMapService {
    TCP_SERVICE
        .get_or_init(|| Arc::new(RwLock::new(TcpMapService::new())))
        .clone()
}

#[tauri::command]
pub async fn add_tcp_service(app: AppHandle, server_socket: String, socket: String) -> Result<(), String> {
    let service = TCP_SERVICE.get().cloned().ok_or("TCP Service not initialized")?;
    let mut lock = service.write().await;
    let mut tcp_service = TcpService::new(socket).await.map_err(|e| e.to_string())?;
    tcp_service.start(app, server_socket.clone()).await;
    lock.add(server_socket, Box::new(tcp_service));
    Ok(())
}

// 提供线程安全的全局访问方法
#[tauri::command]
pub async fn send_tcp_service(server_socket: String, data: Vec<u8>) -> Result<(), String> {
    let service = TCP_SERVICE.get().cloned().ok_or("TCP Service not initialized")?;
    let mut lock = service.write().await;
    lock.send_with_server(server_socket, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn send_tcp_service_no_prefix(server_socket: String, data: Vec<u8>) -> Result<(), String> {
    let service = TCP_SERVICE.get().cloned().ok_or("TCP Service not initialized")?;
    let mut lock = service.write().await;
    lock.send_with_server(server_socket, data).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn listen_tcp_service(server_socket: String, app: AppHandle) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let mut lock = service.write().await;
        lock.listen(server_socket, app).await.unwrap();
    });
}

pub async fn remove_tcp_service(server_socket: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _ = runtime.block_on(async {
        let mut lock = service.write().await;
        lock.remove(server_socket)
    });
}

pub async fn contains_tcp_service(server_socket: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _ = runtime.block_on(async {
        let lock = service.write().await;
        lock.contains(server_socket)
    });
}
