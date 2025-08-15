use crate::controller::encryption::Encryption;
use crate::service::net::receive_message::ReceiveService;
use base64::decode;
use pem::Pem;
use ring::agreement::UnparsedPublicKey;
use ring::rsa::PublicKey;
use ring::signature::{RsaKeyPair, RsaPublicKeyComponents};
use ring::{agreement, signature};
use rsa::pkcs1::DecodeRsaPublicKey;
use rsa::RsaPublicKey;
use std::sync::Arc;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::OnceCell;

pub static mut TCP_SERVICE: OnceCell<TcpService> = OnceCell::const_new();

#[derive(Debug)]
pub struct TcpService {
    socket: String,
    stream: TcpStream,
    receiver: ReceiveService,
    encryption: Encryption,
}

impl TcpService {
    /// 创建一个新的TCP服务实例
    ///
    /// 该函数会尝试建立TCP连接，如果初次连接失败会进行重试机制
    ///
    /// # 参数
    /// * `socket` - 要连接的socket地址字符串
    ///
    /// # 返回值
    /// 无返回值，但会设置全局的TCP_SERVICE静态变量
    pub async fn new(socket: String) {
        // 尝试创建TCP资源连接
        let resource = TcpService::crate_resource(socket.clone()).await;
        match resource {
            Ok(v) => unsafe {
                TCP_SERVICE.set(v).unwrap();
            },
            Err(e) => {
                tracing::error!("{}", e);
                // 连接失败时进行重试，目前只重试一次
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

    /// 创建一个新的资源实例
    ///
    /// 该函数通过连接到指定的socket地址来创建资源实例，包括建立TCP连接
    /// 和初始化接收服务。
    ///
    /// # 参数
    /// * `socket` - 要连接的socket地址字符串
    ///
    /// # 返回值
    /// 返回Result包装的Self实例，成功时包含新创建的资源对象，失败时包含错误信息
    ///
    /// # 错误
    /// 当TCP连接失败时会返回错误
    async fn crate_resource(socket: String) -> anyhow::Result<Self> {
        // 建立TCP连接
        let tcp = TcpStream::connect(socket.clone()).await?;
        Ok(Self {
            socket: socket.clone(),
            stream: tcp,
            receiver: ReceiveService::new(socket.clone()),
            encryption: Encryption::new(),
        })
    }

    async fn send_keep_alive(&mut self) -> std::io::Result<()> {
        self.stream.write_all("".as_bytes()).await
    }

    fn send_keep_alive_service(mut self: &Arc<Self>) {
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                let _ = self.send_keep_alive().await;
            }
        });
    }

    pub(crate) async fn send_message(
        &mut self,
        message: String,
        key: PublicKey,
    ) -> std::io::Result<()> {
        self.stream.write_all(message.as_bytes()).await
    }

    pub async fn receive_message(&mut self) -> anyhow::Result<()> {
        self.clone()
            .receiver
            .receive_loop(self.socket.clone())
            .await?;
        Ok(())
    }
    pub async fn receive_rsa(&mut self) {

    }

    pub async fn start_connect(&mut self) {
    }
}
