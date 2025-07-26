use crate::mapper::common_message::CommonNoticeMessage;
use crate::service::message::notification::notification;
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::net::TcpStream;
use tokio::spawn;

#[derive(Copy, Clone, Default)]
pub struct ReceiveService;

impl ReceiveService {
    pub fn new() -> Self {
        ReceiveService
    }

    pub async fn receive_loop(self) -> anyhow::Result<()> {
        let tcp_listener = tokio::net::TcpListener::bind("127.0.0.1:8080").await?;
        loop {
            let (tcp_stream, _) = tcp_listener.accept().await?;
            spawn(async move { self.receive_message(tcp_stream).await });
        }
    }

    /// 从TCP流中读取4字节的大端序长度字段，并转换为usize类型
    ///
    /// # 参数
    /// * `tcp_stream` - 可变引用的TCP流对象，用于读取长度数据
    ///
    /// # 返回值
    /// 返回解析得到的TCP包长度值（字节为单位）
    pub async fn get_tcp_packet_len(&self, tcp_stream: &mut TcpStream) -> usize {
        // 读取4字节长度字段到缓冲区
        let mut len_buf = [0u8; 4];
        tcp_stream.read_exact(&mut len_buf).await.unwrap();

        // 将大端序字节数组转换为u32类型，再转换为usize返回
        u32::from_be_bytes(len_buf) as usize
    }

    pub async fn receive_message(&self, mut tcp_stream: TcpStream) -> anyhow::Result<()> {
        let len = self.get_tcp_packet_len(&mut tcp_stream).await;
        let mut buf = vec![0u8; len];
        let mut reader = tokio::io::BufReader::new(tcp_stream);
        let _ = reader.read_exact(&mut buf).await;

        let value: Arc<CommonNoticeMessage> = Arc::new(serde_json::from_slice(&buf)?);

        // TODO: 任务分发
        // TODO: 允许该服务被注册到tauri
        notification(value).await?;
        // TODO: 处理接受信息部分的错误
        Ok(())
    }
}
