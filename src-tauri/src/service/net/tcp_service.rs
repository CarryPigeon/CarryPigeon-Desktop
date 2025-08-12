use crate::service::net::receive_message::ReceiveService;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;

pub struct TcpService {
    socket: String,
    stream: TcpStream,
    receiver: ReceiveService,
}

impl TcpService {
    pub async fn new(socket: String) -> anyhow::Result<Self> {
        let tcp = TcpStream::connect(socket.clone()).await?;
        Ok(Self {
            socket,
            stream: tcp,
            receiver: ReceiveService::new(),
        })
    }
    pub async fn send_keep_alive(&mut self) -> std::io::Result<()> {
        self.stream.write_all("".as_bytes()).await
    }

    pub async fn send_message(&mut self, message: String) -> std::io::Result<()> {
        self.stream.write_all(message.as_bytes()).await
    }

    pub async fn receive_message(&mut self) -> anyhow::Result<()> {
        self.receiver.receive_loop(self.socket.clone()).await?;
        Ok(())
    }
}
