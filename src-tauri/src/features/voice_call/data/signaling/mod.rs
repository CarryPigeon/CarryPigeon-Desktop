use anyhow::Context;
use tokio::sync::{Mutex, RwLock, mpsc};
use tracing::{info, warn};

use crate::features::voice_call::domain::model::SignalingMessage;

/// WebSocket-based signaling client for SDP/ICE relay.
///
/// Uses mpsc channels to bridge between sync Tauri command handlers and the
/// async WebSocket read/write loops that run in a background task.
pub struct SignalingClient {
    /// Send JSON strings to the write task
    write_tx: Mutex<Option<mpsc::UnboundedSender<String>>>,
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

        // Channels: commands → WS write task, WS read task → poll
        let (write_tx, mut write_rx) = mpsc::unbounded_channel::<String>();
        let (read_tx, read_rx) = mpsc::unbounded_channel::<SignalingMessage>();

        // Spawn write task
        tokio::spawn(async move {
            while let Some(msg) = write_rx.recv().await {
                if let Err(e) = write
                    .send(tokio_tungstenite::tungstenite::Message::Text(msg.into()))
                    .await
                {
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
                .send(payload)
                .map_err(|_| anyhow::anyhow!("VOICE_CALL_SIGNALING_FAILED: send channel closed")),
            None => anyhow::bail!("VOICE_CALL_SIGNALING_FAILED: not connected"),
        }
    }

    /// Non-blocking poll for the next received signaling message
    pub async fn recv(&self) -> anyhow::Result<Option<SignalingMessage>> {
        match self.read_rx.lock().await.as_mut() {
            Some(rx) => match rx.try_recv() {
                Ok(msg) => Ok(Some(msg)),
                Err(mpsc::error::TryRecvError::Empty) => Ok(None),
                Err(mpsc::error::TryRecvError::Disconnected) => Ok(None),
            },
            None => Ok(None),
        }
    }

    pub async fn is_connected(&self) -> bool {
        *self.connected.read().await
    }

    pub async fn disconnect(&self) {
        *self.connected.write().await = false;
        *self.write_tx.lock().await = None;
        *self.read_rx.lock().await = None;
        info!(action = "app_voice_call_signaling_disconnected");
    }
}
