use anyhow::Result;
use std::collections::HashMap;
use tokio::sync::Mutex;
use tracing::info;

pub struct PeerConnectionHandle {
    pub session_id: String,
}

pub struct WebRtcPeerManager {
    connections: Mutex<HashMap<String, PeerConnectionHandle>>,
}

impl WebRtcPeerManager {
    pub fn new() -> Self {
        Self {
            connections: Mutex::new(HashMap::new()),
        }
    }

    pub async fn create_peer_connection(&self, session_id: &str) -> Result<PeerConnectionHandle> {
        info!(
            action = "app_voice_call_create_peer_connection",
            session_id = %session_id,
        );

        let mut conns = self.connections.lock().await;
        conns.insert(
            session_id.to_string(),
            PeerConnectionHandle {
                session_id: session_id.to_string(),
            },
        );

        Ok(PeerConnectionHandle {
            session_id: session_id.to_string(),
        })
    }

    pub async fn close_peer_connection(&self, session_id: &str) -> Result<()> {
        info!(
            action = "app_voice_call_close_peer_connection",
            session_id = %session_id,
        );

        let mut conns = self.connections.lock().await;
        conns.remove(session_id);
        Ok(())
    }

    pub async fn has_connection(&self, session_id: &str) -> bool {
        let conns = self.connections.lock().await;
        conns.contains_key(session_id)
    }
}
