use std::collections::HashMap;
use tokio::sync::Mutex;

use crate::features::voice_call::domain::model::*;
use crate::features::voice_call::domain::ports::*;
use crate::shared::error::CommandResult;

pub struct MockVoiceCallService {
    sessions: Mutex<HashMap<String, CallSession>>,
}

impl MockVoiceCallService {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    }
}

impl Default for MockVoiceCallService {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait::async_trait]
impl VoiceCallStatePort for MockVoiceCallService {
    async fn start_direct_call(
        &self,
        session_id: &str,
        target_user_id: &str,
        room_id: &str,
    ) -> CommandResult<CallSession> {
        let session = CallSession {
            session_id: session_id.to_string(),
            call_kind: CallKind::Direct,
            state: CallState::Dialing,
            initiator: "local-user".to_string(),
            participants: vec![Participant {
                user_id: target_user_id.to_string(),
                display_name: "Mock User".to_string(),
                is_muted: false,
                is_speaking: false,
                audio_level: 0.0,
                joined_at: None,
            }],
            room_id: room_id.to_string(),
            started_at: Some(Self::now()),
            ended_at: None,
            media_settings: MediaSettings {
                input_device_id: None,
                output_device_id: None,
                noise_suppression: false,
                echo_cancellation: false,
            },
        };

        self.sessions
            .lock()
            .await
            .insert(session_id.to_string(), session.clone());
        Ok(session)
    }

    async fn start_conference(
        &self,
        session_id: &str,
        room_id: &str,
    ) -> CommandResult<CallSession> {
        let session = CallSession {
            session_id: session_id.to_string(),
            call_kind: CallKind::Conference,
            state: CallState::Dialing,
            initiator: String::new(),
            participants: Vec::new(),
            room_id: room_id.to_string(),
            started_at: Some(Self::now()),
            ended_at: None,
            media_settings: MediaSettings {
                input_device_id: None,
                output_device_id: None,
                noise_suppression: false,
                echo_cancellation: false,
            },
        };

        self.sessions
            .lock()
            .await
            .insert(session_id.to_string(), session.clone());
        Ok(session)
    }

    async fn accept_call(&self, session_id: &str) -> CommandResult<()> {
        if let Some(s) = self.sessions.lock().await.get_mut(session_id) {
            s.state = CallState::Active;
        }
        Ok(())
    }

    async fn reject_call(&self, session_id: &str, _reason: Option<&str>) -> CommandResult<()> {
        if let Some(s) = self.sessions.lock().await.get_mut(session_id) {
            s.state = CallState::Ended;
            s.ended_at = Some(Self::now());
        }
        Ok(())
    }

    async fn hangup_call(&self, session_id: &str) -> CommandResult<()> {
        if let Some(s) = self.sessions.lock().await.get_mut(session_id) {
            s.state = CallState::Ended;
            s.ended_at = Some(Self::now());
        }
        Ok(())
    }

    async fn toggle_mute(&self, session_id: &str) -> CommandResult<bool> {
        let mut guard = self.sessions.lock().await;
        let s = guard
            .get_mut(session_id)
            .ok_or_else(|| "[VOICE_CALL_FAILED] Session not found".to_string())?;
        let p = s
            .participants
            .first_mut()
            .ok_or_else(|| "[VOICE_CALL_FAILED] No participants".to_string())?;
        p.is_muted = !p.is_muted;
        Ok(p.is_muted)
    }

    async fn toggle_noise_suppression(&self, session_id: &str) -> CommandResult<bool> {
        let mut guard = self.sessions.lock().await;
        let s = guard
            .get_mut(session_id)
            .ok_or_else(|| "[VOICE_CALL_FAILED] Session not found".to_string())?;
        s.media_settings.noise_suppression = !s.media_settings.noise_suppression;
        Ok(s.media_settings.noise_suppression)
    }

    async fn select_input_device(&self, _session_id: &str, _device_id: &str) -> CommandResult<()> {
        Ok(())
    }

    async fn select_output_device(&self, _session_id: &str, _device_id: &str) -> CommandResult<()> {
        Ok(())
    }

    fn get_active_session(&self) -> Option<CallSession> {
        None
    }
}

#[async_trait::async_trait]
impl SignalingPort for MockVoiceCallService {
    async fn connect(&self, _ws_url: &str, _access_token: &str) -> CommandResult<()> {
        Ok(())
    }

    async fn send(&self, _msg: SignalingMessage) -> CommandResult<()> {
        Ok(())
    }

    async fn recv(&self) -> CommandResult<Option<SignalingMessage>> {
        Ok(None)
    }

    fn is_connected(&self) -> bool {
        false
    }

    async fn disconnect(&self) -> CommandResult<()> {
        Ok(())
    }
}

#[async_trait::async_trait]
impl AudioPipelinePort for MockVoiceCallService {
    async fn start_capture(&self, _device_id: Option<&str>) -> CommandResult<()> {
        Ok(())
    }

    async fn start_playback(&self, _device_id: Option<&str>) -> CommandResult<()> {
        Ok(())
    }

    async fn stop_capture(&self) -> CommandResult<()> {
        Ok(())
    }

    async fn stop_playback(&self) -> CommandResult<()> {
        Ok(())
    }

    async fn take_encoded_packets(&self) -> Vec<Vec<u8>> {
        Vec::new()
    }

    async fn push_encoded_packet(&self, _packet: Vec<u8>) {}

    fn set_mute(&self, _muted: bool) {}

    fn set_noise_suppression(&self, _enabled: bool) {}
}
