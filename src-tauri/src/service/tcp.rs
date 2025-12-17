use std::collections::HashMap;
use std::sync::{Arc, OnceLock};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::RwLock;

pub struct TcpService {
    listener: TcpListener,
    stream: TcpStream,
}

#[derive(Default)]
pub struct TcpMapService {
    map: HashMap<String, Box<TcpService>>,
}

type SharedTcpMapService = Arc<RwLock<TcpMapService>>;
pub static TCP_SERVICE: OnceLock<SharedTcpMapService> = OnceLock::new();

impl TcpService {
    pub async fn new(socket: String) -> anyhow::Result<Self> {
        let listener = TcpListener::bind(&socket)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to bind TCP listener: {}", e))?;

        let stream = TcpStream::connect(socket)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to connect TCP stream: {}", e))?;

        Ok(TcpService { listener, stream })
    }

    pub async fn start(&mut self, app: AppHandle) {
        while let Ok((mut socket, addr)) = self.listener.accept().await {
            let app = app.clone();
            tokio::spawn(async move {
                let mut buffer = vec![0; 4096];
                loop {
                    match socket.read(&mut buffer).await {
                        Ok(0) => {
                            return;
                        }
                        Ok(n) => match String::from_utf8(buffer[..n].to_vec()) {
                            Ok(res) => {
                                if let Err(e) = app.emit("tcp-message", res) {
                                    tracing::warn!("Failed to emit TCP message: {:?}", e);
                                }
                            }
                            Err(e) => {
                                tracing::warn!("Failed to parse string from socket; err={:?}", e);
                                break;
                            }
                        },
                        Err(e) => {
                            tracing::warn!(
                                "Failed to read from socket; err={:?}, addr={}",
                                e,
                                addr
                            );
                            break;
                        }
                    }
                }
            });
        }
    }

    pub async fn send(&mut self, data: String) -> anyhow::Result<()> {
        self.stream
            .write_all(data.as_bytes())
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send TCP data: {}", e))
    }
}

impl TcpMapService {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add(&mut self, channel_socket: String, service: Box<TcpService>) {
        // 如果已存在相同 channel_id 的连接，先记录日志
        if self.map.contains_key(&channel_socket) {
            tracing::info!(
                "Replacing existing TCP service for channel_id: {}",
                channel_socket
            );
        }
        self.map.insert(channel_socket, service);
    }

    pub async fn send_with_server(
        &mut self,
        server_socket: String,
        data: String,
    ) -> anyhow::Result<()> {
        match self.map.get_mut(&server_socket) {
            Some(service) => service.send(data).await,
            None => Err(anyhow::anyhow!(
                "TCP service not found for channel_id: {}",
                server_socket
            )),
        }
    }

    pub async fn listen(&mut self, channel_socket: String, app: AppHandle) -> anyhow::Result<()> {
        match self.map.get_mut(&channel_socket) {
            Some(service) => {
                service.start(app).await;
                Ok(())
            }
            None => Err(anyhow::anyhow!(
                "TCP service not found for channel_id: {}",
                channel_socket
            )),
        }
    }

    pub fn remove(&mut self, channel_socket: String) -> bool {
        self.map.remove(&channel_socket).is_some()
    }

    pub fn contains(&self, channel_socket: String) -> bool {
        self.map.contains_key(&channel_socket)
    }
}

// 初始化全局TCP服务
pub fn init_tcp_service() -> SharedTcpMapService {
    TCP_SERVICE
        .get_or_init(|| Arc::new(RwLock::new(TcpMapService::new())))
        .clone()
}

#[tauri::command]
pub fn add_tcp_service(channel_socket: String, socket: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let mut lock = service.write().await;
        let tcp_service = TcpService::new(socket).await.unwrap();
        lock.add(channel_socket, Box::new(tcp_service));
    });
}

// 提供线程安全的全局访问方法
#[tauri::command]
pub fn send_tcp_service(channel_socket: String, data: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let mut lock = service.write().await;
        lock.send_with_server(channel_socket, data).await.unwrap();
    });
}

#[tauri::command]
pub async fn listen_tcp_service(channel_socket: String, app: AppHandle) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    runtime.block_on(async {
        let mut lock = service.write().await;
        lock.listen(channel_socket, app).await.unwrap();
    });
}

pub async fn remove_tcp_service(channel_socket: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _ = runtime.block_on(async {
        let mut lock = service.write().await;
        lock.remove(channel_socket)
    });
}

pub async fn contains_tcp_service(channel_socket: String) {
    let service = TCP_SERVICE.get().cloned().unwrap();
    let runtime = tokio::runtime::Runtime::new().unwrap();
    let _ = runtime.block_on(async {
        let lock = service.write().await;
        lock.contains(channel_socket)
    });
}
