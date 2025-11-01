use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use tauri::ipc::Channel;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

struct TcpService {
    listener: TcpListener,
    stream: TcpStream,
}

type TcpMap = HashMap<i32, Box<TcpService>>;
struct TcpMapService{
    map: TcpMap,
}

impl TcpService {
    pub async fn new(socket:String) -> Self {
        TcpService {
            listener: TcpListener::bind(socket.clone()).await.unwrap(),
            stream: TcpStream::connect(socket).await.unwrap(),
        }
    }
    pub async fn start(&mut self, app: AppHandle) {
         while let Ok((mut socket, _addr)) = self.listener.accept().await {
            let app = app.clone();
            tokio::spawn(async move {
                let mut buffer = vec![0; 1024];
                loop{
                    let n = match socket.read(&mut buffer).await {
                        Ok(0) => {
                            return;
                        },
                        Ok(n) => n,
                        Err(n) => {
                            tracing::warn!("failed to read from socket; err={:?}", n);
                            return;
                        }
                    };
                    let res =  match String::from_utf8(buffer[..n].to_vec()) {
                        Ok(res) => res,
                        Err(e) => {tracing::warn!("failed to parse string from socket; err={:?}", e); return;}
                    };
                    // TODO: 缺少前端监听模块接收数据
                    app.emit("tcp-message", res).unwrap();
                }
            });
        }
    }
    pub async fn send(&mut self, data:String) -> anyhow::Result<()> {
        self.stream.write_all(data.as_bytes()).await?;
        Ok(())
    }
}

impl TcpMapService {
    pub fn new() -> Self {
        Self{
            map: HashMap::new(),
        }
    }
    pub fn add_hashmap(&mut self,channel_id: i32,service:Box<TcpService>){
        self.map.insert(channel_id, service);
    }
    pub async fn send(&mut self, channel_id:i32,data:String) -> anyhow::Result<()> {
        self.map.get_mut(&channel_id).unwrap().send(data).await?;
        Ok(())
    }
    pub async fn listen(&mut self, channel_id:i32, app: AppHandle) {
        self.map.get_mut(&channel_id).unwrap().start(app).await;
    }
}