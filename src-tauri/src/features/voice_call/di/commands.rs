use std::collections::HashMap;
use std::sync::Mutex;

use super::super::data::audio::device::AudioDeviceManager;
use super::super::domain::model::*;
use crate::shared::error::CommandResult;
use tauri::State;

pub struct VoiceCallService {
    audio: Mutex<Option<AudioDeviceManager>>,
    sessions: Mutex<HashMap<String, CallSession>>,
    selected_input: Mutex<Option<String>>,
    selected_output: Mutex<Option<String>>,
}

impl VoiceCallService {
    pub fn new() -> Self {
        let audio = match AudioDeviceManager::new() {
            Ok(manager) => Some(manager),
            Err(e) => {
                tracing::warn!(action = "app_voice_call_service_audio_init_failed", error = %e);
                None
            }
        };
        Self {
            audio: Mutex::new(audio),
            sessions: Mutex::new(HashMap::new()),
            selected_input: Mutex::new(None),
            selected_output: Mutex::new(None),
        }
    }
}

impl Default for VoiceCallService {
    fn default() -> Self {
        Self::new()
    }
}

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn empty_media_settings() -> MediaSettings {
    MediaSettings {
        input_device_id: None,
        output_device_id: None,
        noise_suppression: false,
        echo_cancellation: false,
    }
}

#[tauri::command]
pub async fn start_direct_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
    target_user_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    let session = CallSession {
        session_id: session_id.clone(),
        call_kind: CallKind::Direct,
        state: CallState::Dialing,
        initiator: target_user_id.clone(),
        participants: vec![Participant {
            user_id: target_user_id,
            display_name: String::new(),
            is_muted: false,
            is_speaking: false,
            audio_level: 0.0,
            joined_at: None,
        }],
        room_id,
        started_at: Some(now_secs()),
        ended_at: None,
        media_settings: empty_media_settings(),
    };
    service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?
        .insert(session_id, session.clone());
    Ok(session)
}

#[tauri::command]
pub async fn start_conference(
    service: State<'_, VoiceCallService>,
    session_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    let session = CallSession {
        session_id: session_id.clone(),
        call_kind: CallKind::Conference,
        state: CallState::Dialing,
        initiator: String::new(),
        participants: Vec::new(),
        room_id,
        started_at: Some(now_secs()),
        ended_at: None,
        media_settings: empty_media_settings(),
    };
    service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?
        .insert(session_id, session.clone());
    Ok(session)
}

#[tauri::command]
pub async fn accept_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<()> {
    let mut sessions = service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
    session.state = CallState::Active;
    Ok(())
}

#[tauri::command]
pub async fn reject_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
    _reason: Option<String>,
) -> CommandResult<()> {
    let mut sessions = service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
    session.state = CallState::Ended;
    session.ended_at = Some(now_secs());
    Ok(())
}

#[tauri::command]
pub async fn hangup_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<()> {
    let mut sessions = service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
    session.state = CallState::Ended;
    session.ended_at = Some(now_secs());
    Ok(())
}

#[tauri::command]
pub async fn toggle_mute(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    let mut sessions = service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
    let participant = session
        .participants
        .first_mut()
        .ok_or_else(|| "[VOICE_CALL_FAILED] No participants in session".to_string())?;
    participant.is_muted = !participant.is_muted;
    Ok(participant.is_muted)
}

#[tauri::command]
pub async fn toggle_noise_suppression(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    let mut sessions = service
        .sessions
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
    session.media_settings.noise_suppression = !session.media_settings.noise_suppression;
    Ok(session.media_settings.noise_suppression)
}

#[tauri::command]
pub async fn enumerate_input_devices(
    service: State<'_, VoiceCallService>,
) -> CommandResult<Vec<AudioDeviceInfo>> {
    let audio = service
        .audio
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    match audio.as_ref() {
        Some(manager) => manager.enumerate_input_devices().map_err(|e| {
            format!(
                "[VOICE_CALL_FAILED] Failed to enumerate input devices: {}",
                e
            )
        }),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn enumerate_output_devices(
    service: State<'_, VoiceCallService>,
) -> CommandResult<Vec<AudioDeviceInfo>> {
    let audio = service
        .audio
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    match audio.as_ref() {
        Some(manager) => manager.enumerate_output_devices().map_err(|e| {
            format!(
                "[VOICE_CALL_FAILED] Failed to enumerate output devices: {}",
                e
            )
        }),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub async fn select_input_device(
    service: State<'_, VoiceCallService>,
    _session_id: String,
    device_id: String,
) -> CommandResult<()> {
    let mut input = service
        .selected_input
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    *input = Some(device_id);
    Ok(())
}

#[tauri::command]
pub async fn select_output_device(
    service: State<'_, VoiceCallService>,
    _session_id: String,
    device_id: String,
) -> CommandResult<()> {
    let mut output = service
        .selected_output
        .lock()
        .map_err(|e| format!("[VOICE_CALL_FAILED] Lock poisoned: {}", e))?;
    *output = Some(device_id);
    Ok(())
}
