use anyhow::Context;
use tokio::sync::{Mutex, RwLock, mpsc};
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tracing::{info, warn};

use crate::features::voice_call::domain::model::SignalingMessage;

/// WebSocket-based signaling client for SDP/ICE relay.
///
/// Uses mpsc channels to bridge between sync Tauri command handlers and the
/// async WebSocket read/write loops that run in a background task.
pub struct SignalingClient {
    /// Send WebSocket frames (Text/Close/Ping…) to the write task
    write_tx: Mutex<Option<mpsc::UnboundedSender<WsMessage>>>,
    /// Receive parsed SignalingMessages from the read task
    read_rx: Mutex<Option<mpsc::UnboundedReceiver<SignalingMessage>>>,
    connected: RwLock<bool>,
}

impl Default for SignalingClient {
    fn default() -> Self {
        Self::new()
    }
}

impl SignalingClient {
    pub fn new() -> Self {
        Self {
            write_tx: Mutex::new(None),
            read_rx: Mutex::new(None),
            connected: RwLock::new(false),
        }
    }

    /// Connect to signaling WebSocket. Spawns a background task for read/write.
    pub async fn connect(&self, ws_url: &str, access_token: &str) -> anyhow::Result<()> {
        use futures_util::{SinkExt, StreamExt};
        use tokio_tungstenite::connect_async;
        use tokio_tungstenite::tungstenite::client::IntoClientRequest;

        let mut req = ws_url
            .into_client_request()
            .context("VOICE_CALL_SIGNALING_FAILED: invalid signaling URL")?;

        req.headers_mut().insert(
            "Authorization",
            format!("Bearer {}", access_token)
                .parse()
                .context("VOICE_CALL_SIGNALING_FAILED")?,
        );

        let (ws_stream, _) = connect_async(req)
            .await
            .context("VOICE_CALL_SIGNALING_FAILED: WebSocket connection failed")?;

        let (mut write, mut read) = ws_stream.split();

        // Channels: frames → WS write task, WS read task → poll
        let (write_tx, mut write_rx) = mpsc::unbounded_channel::<WsMessage>();
        let (read_tx, read_rx) = mpsc::unbounded_channel::<SignalingMessage>();

        // Spawn write task
        tokio::spawn(async move {
            while let Some(msg) = write_rx.recv().await {
                if let Err(e) = write.send(msg).await {
                    warn!(action = "app_voice_call_signaling_write_error", error = %e);
                    break;
                }
            }
        });

        // Spawn read task
        tokio::spawn(async move {
            while let Some(Ok(msg)) = read.next().await {
                match msg {
                    tokio_tungstenite::tungstenite::Message::Text(text) => {
                        match serde_json::from_str::<SignalingMessage>(&text) {
                            Ok(sig) => {
                                let result = read_tx.send(sig);
                                if result.is_err() {
                                    break; // receiver dropped
                                }
                            }
                            Err(e) => {
                                warn!(action = "app_voice_call_signaling_parse_error", error = %e, text = %text);
                            }
                        }
                    }
                    tokio_tungstenite::tungstenite::Message::Close(_) => break,
                    _ => {}
                }
            }
            // 说明：read_tx 在此被 drop。此后接收端的 try_recv 会返回
            // Disconnected，监听循环据此判定“连接已结束”。
        });

        *self.write_tx.lock().await = Some(write_tx);
        *self.read_rx.lock().await = Some(read_rx);
        *self.connected.write().await = true;

        info!(action = "app_voice_call_signaling_connected", ws_url = %ws_url);
        Ok(())
    }

    /// Send a signaling message as JSON over WS
    pub async fn send(&self, msg: &SignalingMessage) -> anyhow::Result<()> {
        if !*self.connected.read().await {
            anyhow::bail!("VOICE_CALL_SIGNALING_FAILED: not connected");
        }

        let payload = serde_json::to_string(msg)
            .context("VOICE_CALL_SIGNALING_FAILED: failed to serialize message")?;

        match self.write_tx.lock().await.as_ref() {
            Some(tx) => tx
                .send(WsMessage::Text(payload.into()))
                .map_err(|_| anyhow::anyhow!("VOICE_CALL_SIGNALING_FAILED: send channel closed")),
            None => anyhow::bail!("VOICE_CALL_SIGNALING_FAILED: not connected"),
        }
    }

    /// 非阻塞拉取下一条信令消息。
    ///
    /// 返回约定（监听循环依赖此语义，勿与阻塞语义混淆）：
    /// - `Ok(Some(msg))`：收到一条消息；
    /// - `Ok(None)`：连接仍建立、暂时没有新消息——**不代表断开**，调用方稍后重试；
    /// - `Err(_)`：未连接或读通道已结束（WS 关闭/出错），调用方应当退出循环。
    pub async fn recv(&self) -> anyhow::Result<Option<SignalingMessage>> {
        let mut guard = self.read_rx.lock().await;
        let Some(rx) = guard.as_mut() else {
            anyhow::bail!("VOICE_CALL_SIGNALING_FAILED: not connected");
        };
        match rx.try_recv() {
            Ok(msg) => Ok(Some(msg)),
            Err(mpsc::error::TryRecvError::Empty) => Ok(None),
            Err(mpsc::error::TryRecvError::Disconnected) => {
                // 先释放 read_rx 锁再取 connected 写锁，避免与
                // disconnect()（先 connected 后 read_rx）形成锁序死锁。
                drop(guard);
                *self.connected.write().await = false;
                warn!(action = "app_voice_call_signaling_read_channel_closed");
                anyhow::bail!("VOICE_CALL_SIGNALING_FAILED: signaling connection closed")
            }
        }
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    /// 断开信令：发送协议级 Close 帧并丢弃两端通道，
    /// 使后台读写任务自然退出、底层 TCP 连接随之释放。
    pub async fn disconnect(&self) {
        *self.connected.write().await = false;
        if let Some(tx) = self.write_tx.lock().await.take() {
            let _ = tx.send(WsMessage::Close(None));
        }
        // 丢弃读端：旧读任务的 read_tx.send 失败后退出，本地连接关闭。
        *self.read_rx.lock().await = None;
        info!(action = "app_voice_call_signaling_disconnected");
    }
}
