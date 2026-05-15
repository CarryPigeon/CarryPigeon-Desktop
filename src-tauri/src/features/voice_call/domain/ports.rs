use crate::shared::error::CommandResult;
use async_trait::async_trait;
use super::model::*;

#[async_trait]
pub trait VoiceCallStatePort: Send + Sync {
    async fn start_direct_call(&self, session_id: &str, target_user_id: &str, room_id: &str) -> CommandResult<CallSession>;
    async fn start_conference(&self, session_id: &str, room_id: &str) -> CommandResult<CallSession>;
    async fn accept_call(&self, session_id: &str) -> CommandResult<()>;
    async fn reject_call(&self, session_id: &str, reason: Option<&str>) -> CommandResult<()>;
    async fn hangup_call(&self, session_id: &str) -> CommandResult<()>;
    async fn toggle_mute(&self, session_id: &str) -> CommandResult<bool>;
    async fn toggle_noise_suppression(&self, session_id: &str) -> CommandResult<bool>;
    async fn select_input_device(&self, session_id: &str, device_id: &str) -> CommandResult<()>;
    async fn select_output_device(&self, session_id: &str, device_id: &str) -> CommandResult<()>;
    fn get_active_session(&self) -> Option<CallSession>;
}
