use super::model::*;
use crate::shared::error::CommandResult;
use async_trait::async_trait;

#[async_trait]
pub trait VoiceCallStatePort: Send + Sync {
    async fn start_direct_call(
        &self,
        session_id: &str,
        target_user_id: &str,
        room_id: &str,
    ) -> CommandResult<CallSession>;
    async fn start_conference(&self, session_id: &str, room_id: &str)
    -> CommandResult<CallSession>;
    async fn accept_call(&self, session_id: &str) -> CommandResult<()>;
    async fn reject_call(&self, session_id: &str, reason: Option<&str>) -> CommandResult<()>;
    async fn hangup_call(&self, session_id: &str) -> CommandResult<()>;
    async fn toggle_mute(&self, session_id: &str) -> CommandResult<bool>;
    async fn toggle_noise_suppression(&self, session_id: &str) -> CommandResult<bool>;
    async fn select_input_device(&self, session_id: &str, device_id: &str) -> CommandResult<()>;
    async fn select_output_device(&self, session_id: &str, device_id: &str) -> CommandResult<()>;
    fn get_active_session(&self) -> Option<CallSession>;
}

/// Port for signaling WebSocket — sends SDP/ICE messages between peers
#[async_trait]
pub trait SignalingPort: Send + Sync {
    /// Connect to the signaling WebSocket
    async fn connect(&self, ws_url: &str, access_token: &str) -> CommandResult<()>;
    /// Send a signaling message to the relay
    async fn send(&self, msg: SignalingMessage) -> CommandResult<()>;
    /// Receive next signaling message (non-blocking poll)
    async fn recv(&self) -> CommandResult<Option<SignalingMessage>>;
    /// Check if connected
    fn is_connected(&self) -> bool;
    /// Disconnect
    async fn disconnect(&self) -> CommandResult<()>;
}

/// Port for audio capture/playback pipeline
#[async_trait]
pub trait AudioPipelinePort: Send + Sync {
    /// Start capturing from the selected input device, producing Opus packets
    async fn start_capture(&self, device_id: Option<&str>) -> CommandResult<()>;
    /// Start playing to the selected output device, consuming Opus packets
    async fn start_playback(&self, device_id: Option<&str>) -> CommandResult<()>;
    /// Stop capture
    async fn stop_capture(&self) -> CommandResult<()>;
    /// Stop playback
    async fn stop_playback(&self) -> CommandResult<()>;
    /// Take buffered Opus packets from capture (called by WebRTC sender loop)
    async fn take_encoded_packets(&self) -> Vec<Vec<u8>>;
    /// Push Opus packets for playback (called by WebRTC receiver callback)
    async fn push_encoded_packet(&self, packet: Vec<u8>);
    /// Set mute — when true, replace captured packets with silence frames
    fn set_mute(&self, muted: bool);
    /// Set noise suppression on/off
    fn set_noise_suppression(&self, enabled: bool);
}
