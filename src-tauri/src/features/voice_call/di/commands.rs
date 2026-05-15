use tauri::State;
use crate::shared::error::CommandResult;
use super::super::domain::model::*;

pub struct VoiceCallService;

#[tauri::command]
pub async fn start_direct_call(
    _service: State<'_, VoiceCallService>,
    session_id: String,
    target_user_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    Err("VOICE_NOT_IMPLEMENTED: start_direct_call not yet implemented".into())
}

#[tauri::command]
pub async fn start_conference(
    _service: State<'_, VoiceCallService>,
    session_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    Err("VOICE_NOT_IMPLEMENTED: start_conference not yet implemented".into())
}

#[tauri::command]
pub async fn accept_call(
    _service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<()> {
    Err("VOICE_NOT_IMPLEMENTED: accept_call not yet implemented".into())
}

#[tauri::command]
pub async fn reject_call(
    _service: State<'_, VoiceCallService>,
    session_id: String,
    reason: Option<String>,
) -> CommandResult<()> {
    let _ = reason;
    Err("VOICE_NOT_IMPLEMENTED: reject_call not yet implemented".into())
}

#[tauri::command]
pub async fn hangup_call(
    _service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<()> {
    Err("VOICE_NOT_IMPLEMENTED: hangup_call not yet implemented".into())
}

#[tauri::command]
pub async fn toggle_mute(
    _service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    Err("VOICE_NOT_IMPLEMENTED: toggle_mute not yet implemented".into())
}

#[tauri::command]
pub async fn toggle_noise_suppression(
    _service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    Err("VOICE_NOT_IMPLEMENTED: toggle_noise_suppression not yet implemented".into())
}

#[tauri::command]
pub async fn enumerate_input_devices(
    _service: State<'_, VoiceCallService>,
) -> CommandResult<Vec<AudioDeviceInfo>> {
    Err("VOICE_NOT_IMPLEMENTED: enumerate_input_devices not yet implemented".into())
}

#[tauri::command]
pub async fn enumerate_output_devices(
    _service: State<'_, VoiceCallService>,
) -> CommandResult<Vec<AudioDeviceInfo>> {
    Err("VOICE_NOT_IMPLEMENTED: enumerate_output_devices not yet implemented".into())
}

#[tauri::command]
pub async fn select_input_device(
    _service: State<'_, VoiceCallService>,
    session_id: String,
    device_id: String,
) -> CommandResult<()> {
    Err("VOICE_NOT_IMPLEMENTED: select_input_device not yet implemented".into())
}

#[tauri::command]
pub async fn select_output_device(
    _service: State<'_, VoiceCallService>,
    session_id: String,
    device_id: String,
) -> CommandResult<()> {
    Err("VOICE_NOT_IMPLEMENTED: select_output_device not yet implemented".into())
}
