use crate::service::net::receive_message::ReceiveService;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::OnceCell;

pub static mut TCP_SERVICE: OnceCell<TcpService> = OnceCell::const_new();

#[derive(Debug)]
pub struct TcpService {
    socket: String,
    stream: TcpStream,
    receiver: ReceiveService,
}

impl TcpService {
    pub async fn new(socket: String) {
        let resource = TcpService::crate_resource(socket.clone()).await;
        match resource {
            Ok(v) => unsafe {
                TCP_SERVICE.set(v).unwrap();
            },
            Err(e) => {
                tracing::error!("{}", e);
                // retry
                for i in 0..1 {
                    tokio::time::sleep(std::time::Duration::from_secs(i)).await;
                    let resource = TcpService::crate_resource(socket.clone()).await;
                    match resource {
                        Ok(v) => {
                            unsafe {
                                TCP_SERVICE.set(v).unwrap();
                            }
                            break;
                        }
                        Err(e) => {
                            tracing::error!("{}", e);
                        }
                    }
                }
            }
        }
        // TODO: 通知前端无法建立连接
        drop(socket);
    }
    async fn crate_resource(socket: String) -> anyhow::Result<Self> {
        let tcp = TcpStream::connect(socket.clone()).await?;
        Ok(Self {
            socket,
            stream: tcp,
            receiver: ReceiveService::new(),
        })
    }
    async fn send_keep_alive(&mut self) -> std::io::Result<()> {
        self.stream.write_all("".as_bytes()).await
    }

    async fn send_message(&mut self, message: String) -> std::io::Result<()> {
        self.stream.write_all(message.as_bytes()).await
    }

    pub async fn receive_message(&mut self) -> anyhow::Result<()> {
        self.receiver.receive_loop(self.socket.clone()).await?;
        Ok(())
    }
}
