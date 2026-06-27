use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

use super::super::data::audio::device::AudioDeviceManager;
use super::super::data::audio::pipeline::AudioPipeline;
use super::super::data::signaling::SignalingClient;
use super::super::data::webrtc::peer_manager::WebRtcPeerManager;
use super::super::di::events::{CallStateChangeEvent, IncomingCallEvent};
use super::super::domain::model::*;
use crate::shared::error::CommandResult;
use tauri::{Emitter, State};

pub struct VoiceCallService {
    inner: Arc<VoiceCallInner>,
}

pub struct VoiceCallInner {
    audio: Mutex<Option<AudioDeviceManager>>,
    sessions: Mutex<HashMap<String, CallSession>>,
    session_offers: Mutex<HashMap<String, String>>,
    selected_input: Mutex<Option<String>>,
    selected_output: Mutex<Option<String>>,
    webrtc: Mutex<Option<WebRtcPeerManager>>,
    signaling: Mutex<Option<SignalingClient>>,
    audio_pipeline: Mutex<Option<Arc<AudioPipeline>>>,
    local_user_id: Mutex<Option<String>>,
    local_display_name: Mutex<Option<String>>,
}

impl VoiceCallInner {
    fn new() -> Self {
        let audio = match AudioDeviceManager::new() {
            Ok(manager) => Some(manager),
            Err(e) => {
                tracing::warn!(
                    action = "app_voice_call_service_audio_init_failed",
                    error = %e
                );
                None
            }
        };
        Self {
            audio: Mutex::new(audio),
            sessions: Mutex::new(HashMap::new()),
            session_offers: Mutex::new(HashMap::new()),
            selected_input: Mutex::new(None),
            selected_output: Mutex::new(None),
            webrtc: Mutex::new(None),
            signaling: Mutex::new(None),
            audio_pipeline: Mutex::new(None),
            local_user_id: Mutex::new(None),
            local_display_name: Mutex::new(None),
        }
    }

    async fn get_pipeline(self: &Arc<Self>) -> Result<Arc<AudioPipeline>, String> {
        let mut guard = self.audio_pipeline.lock().await;
        if guard.is_none() {
            let pipeline = AudioPipeline::new()
                .map_err(|e| format!("[VOICE_CALL_AUDIO_ENCODE_FAILED] {}", e))?;
            *guard = Some(Arc::new(pipeline));
        }
        Ok(guard
            .as_ref()
            .ok_or_else(|| "[VOICE_CALL_AUDIO_ENCODE_FAILED] pipeline not initialized".to_string())?
            .clone())
    }

    async fn cleanup_session(self: &Arc<Self>, session_id: &str) {
        if let Some(ref w) = *self.webrtc.lock().await {
            let _ = w.close_peer_connection(session_id).await;
        }

        if let Some(ref p) = *self.audio_pipeline.lock().await {
            let _ = p.stop_capture().await;
            let _ = p.stop_playback().await;
        }
    }
}

impl VoiceCallService {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(VoiceCallInner::new()),
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

const CALL_TIMEOUT_SECS: u64 = 60;

async fn spawn_call_timeout(
    inner: Arc<VoiceCallInner>,
    app_handle: tauri::AppHandle,
    session_id: String,
) {
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_secs(CALL_TIMEOUT_SECS)).await;

        let sessions = inner.sessions.lock().await;
        let should_cancel = sessions
            .get(&session_id)
            .map(|s| s.state == CallState::Dialing || s.state == CallState::Ringing)
            .unwrap_or(false);

        if should_cancel {
            tracing::warn!(action = "app_voice_call_timeout", session_id = %session_id);

            // Send reject/hangup via signaling
            {
                let sig_guard = inner.signaling.lock().await;
                if let Some(ref client) = *sig_guard {
                    let _ = client
                        .send(&SignalingMessage::CallHangup {
                            session_id: session_id.clone(),
                        })
                        .await;
                }
            }

            // End session
            {
                let mut sessions = inner.sessions.lock().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = CallState::Ended;
                    s.ended_at = Some(now_secs());
                }
            }

            inner.cleanup_session(&session_id).await;

            let _ = app_handle.emit(
                "voice_call:state_change",
                CallStateChangeEvent {
                    session_id,
                    new_state: CallState::Ended,
                    reason: Some("timeout".to_string()),
                },
            );
        }
    });
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
    app_handle: tauri::AppHandle,
    session_id: String,
    target_user_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    let inner = service.inner.clone();

    let local_uid = inner.local_user_id.lock().await.clone().unwrap_or_default();

    let session = CallSession {
        session_id: session_id.clone(),
        call_kind: CallKind::Direct,
        state: CallState::Dialing,
        initiator: local_uid.clone(),
        participants: vec![Participant {
            user_id: target_user_id.clone(),
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

    inner
        .sessions
        .lock()
        .await
        .insert(session_id.clone(), session.clone());

    // Create WebRTC offer and send via signaling
    let offer = {
        let webrtc_guard = inner.webrtc.lock().await;
        let webrtc = webrtc_guard
            .as_ref()
            .ok_or_else(|| "[VOICE_CALL_FAILED] WebRTC not initialized".to_string())?;
        webrtc
            .create_offer(&session_id)
            .await
            .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?
    };

    let sig_guard = inner.signaling.lock().await;
    if let Some(ref client) = *sig_guard {
        client
            .send(&SignalingMessage::CallInvite {
                session_id: session_id.clone(),
                target_uid: target_user_id,
                sdp_offer: offer.sdp,
                ice_candidates: offer.candidates,
            })
            .await
            .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?;
    }
    drop(sig_guard);

    // Spawn ICE monitor for this session
    let inner_clone = inner.clone();
    let session_id_clone = session_id.clone();
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        monitor_ice_state(inner_clone, &session_id_clone, app_handle_clone).await;
    });

    // Spawn call timeout for dialing state
    spawn_call_timeout(inner.clone(), app_handle.clone(), session_id.clone()).await;

    Ok(session)
}

#[tauri::command]
pub async fn start_conference(
    service: State<'_, VoiceCallService>,
    app_handle: tauri::AppHandle,
    session_id: String,
    room_id: String,
) -> CommandResult<CallSession> {
    let inner = service.inner.clone();

    let user_id = inner.local_user_id.lock().await.clone().unwrap_or_default();
    let display_name = inner
        .local_display_name
        .lock()
        .await
        .clone()
        .unwrap_or_default();

    let session = CallSession {
        session_id: session_id.clone(),
        call_kind: CallKind::Conference,
        state: CallState::Active,
        initiator: user_id.clone(),
        participants: vec![Participant {
            user_id: user_id.clone(),
            display_name: display_name.clone(),
            is_muted: false,
            is_speaking: false,
            audio_level: 0.0,
            joined_at: Some(now_secs()),
        }],
        room_id,
        started_at: Some(now_secs()),
        ended_at: None,
        media_settings: empty_media_settings(),
    };

    inner
        .sessions
        .lock()
        .await
        .insert(session_id.clone(), session.clone());

    // Start audio pipeline + enable conference mode
    let pipeline = inner.get_pipeline().await?;
    pipeline.enable_conference_mode();
    let _ = pipeline.register_participant(&user_id);

    let input_id = inner.selected_input.lock().await.clone();
    let output_id = inner.selected_output.lock().await.clone();

    pipeline
        .start_capture(input_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_CAPTURE_FAILED] {}", e))?;
    pipeline
        .start_playback(output_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_PLAYBACK_FAILED] {}", e))?;

    // Emit state change
    let _ = app_handle.emit(
        "voice_call:state_change",
        CallStateChangeEvent {
            session_id: session_id.clone(),
            new_state: CallState::Active,
            reason: None,
        },
    );

    // Spawn conference audio send loop
    let inner_clone = inner.clone();
    let sid = session_id.clone();
    tokio::spawn(async move {
        audio_send_loop_conference(inner_clone, &sid).await;
    });

    Ok(session)
}

#[tauri::command]
pub async fn join_conference(
    service: State<'_, VoiceCallService>,
    app_handle: tauri::AppHandle,
    session_id: String,
    initiator_id: Option<String>,
) -> CommandResult<CallSession> {
    let inner = service.inner.clone();

    let user_id = inner.local_user_id.lock().await.clone().unwrap_or_default();
    let display_name = inner
        .local_display_name
        .lock()
        .await
        .clone()
        .unwrap_or_default();

    // Send ConferenceJoin via signaling — the initiator/global listener handles the rest
    let sig_guard = inner.signaling.lock().await;
    if let Some(ref client) = *sig_guard {
        client
            .send(&SignalingMessage::ConferenceJoin {
                session_id: session_id.clone(),
                user_id: user_id.clone(),
                display_name: display_name.clone(),
            })
            .await
            .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?;
    }
    drop(sig_guard);

    // Create local session in joining state
    let session = CallSession {
        session_id: session_id.clone(),
        call_kind: CallKind::Conference,
        state: CallState::Connecting,
        initiator: initiator_id.clone().unwrap_or_default(),
        participants: vec![Participant {
            user_id: user_id.clone(),
            display_name: display_name.clone(),
            is_muted: false,
            is_speaking: false,
            audio_level: 0.0,
            joined_at: Some(now_secs()),
        }],
        room_id: String::new(),
        started_at: Some(now_secs()),
        ended_at: None,
        media_settings: empty_media_settings(),
    };

    inner
        .sessions
        .lock()
        .await
        .insert(session_id.clone(), session.clone());

    // Start audio capture
    let pipeline = inner.get_pipeline().await?;
    pipeline.enable_conference_mode();
    let _ = pipeline.register_participant(&user_id);

    let input_id = inner.selected_input.lock().await.clone();
    let output_id = inner.selected_output.lock().await.clone();

    pipeline
        .start_capture(input_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_CAPTURE_FAILED] {}", e))?;
    pipeline
        .start_playback(output_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_PLAYBACK_FAILED] {}", e))?;

    let _ = app_handle.emit(
        "voice_call:state_change",
        CallStateChangeEvent {
            session_id: session_id.clone(),
            new_state: CallState::Connecting,
            reason: None,
        },
    );

    Ok(session)
}

#[tauri::command]
pub async fn leave_conference(
    service: State<'_, VoiceCallService>,
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<()> {
    let inner = service.inner.clone();

    let user_id = inner.local_user_id.lock().await.clone().unwrap_or_default();

    // Send leave via signaling
    let sig_guard = inner.signaling.lock().await;
    if let Some(ref client) = *sig_guard {
        let _ = client
            .send(&SignalingMessage::ConferenceLeave {
                session_id: session_id.clone(),
                user_id: user_id.clone(),
            })
            .await;
    }
    drop(sig_guard);

    // Clean up WebRTC connections for this session
    let webrtc_guard = inner.webrtc.lock().await;
    if let Some(ref wm) = *webrtc_guard {
        wm.close_all_for_session(&session_id).await;
    }
    drop(webrtc_guard);

    // End session（先持 sessions 锁，再持 audio_pipeline 锁，保持一致顺序避免死锁）
    let session_ended = {
        let mut sessions = inner.sessions.lock().await;
        if let Some(s) = sessions.get_mut(&session_id) {
            s.state = CallState::Ended;
            s.ended_at = Some(now_secs());
            true
        } else {
            false
        }
    };

    // Disable conference mode and stop audio（sessions 锁已释放）
    let pipeline_guard = inner.audio_pipeline.lock().await;
    if let Some(ref p) = *pipeline_guard {
        p.unregister_participant(&user_id);
        p.disable_conference_mode();
        let _ = p.stop_capture().await;
        let _ = p.stop_playback().await;
    }
    drop(pipeline_guard);

    if !session_ended {
        tracing::warn!(
            action = "app_voice_call_leave_conference_session_not_found",
            session_id = %session_id,
        );
    }

    let _ = app_handle.emit(
        "voice_call:state_change",
        CallStateChangeEvent {
            session_id,
            new_state: CallState::Ended,
            reason: Some("left".to_string()),
        },
    );

    Ok(())
}

#[tauri::command]
pub async fn accept_call(
    service: State<'_, VoiceCallService>,
    app_handle: tauri::AppHandle,
    session_id: String,
) -> CommandResult<()> {
    let inner = service.inner.clone();

    // Retrieve stored SDP offer
    let offer_sdp = {
        let offers = inner.session_offers.lock().await;
        offers
            .get(&session_id)
            .cloned()
            .ok_or_else(|| "[VOICE_CALL_FAILED] No offer SDP stored for session".to_string())?
    };

    // Update state to connecting
    {
        let mut sessions = inner.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
        session.state = CallState::Connecting;
    }

    // Create WebRTC answer
    let answer = {
        let webrtc_guard = inner.webrtc.lock().await;
        let webrtc = webrtc_guard
            .as_ref()
            .ok_or_else(|| "[VOICE_CALL_FAILED] WebRTC not initialized".to_string())?;
        webrtc
            .create_answer(&session_id, &offer_sdp)
            .await
            .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?
    };

    // Process ICE candidates that arrived with the CallInvite
    {
        let offers = inner.session_offers.lock().await;
        if let Some(candidates_json) = offers.get(&format!("{}:candidates", session_id))
            && let Ok(candidates) = serde_json::from_str::<Vec<String>>(candidates_json)
        {
            let webrtc_guard = inner.webrtc.lock().await;
            if let Some(ref wm) = *webrtc_guard {
                for c in &candidates {
                    let _ = wm.add_remote_candidate(&session_id, c).await;
                }
            }
        }
    }

    // Send CallAccept via signaling
    {
        let sig_guard = inner.signaling.lock().await;
        if let Some(ref client) = *sig_guard {
            client
                .send(&SignalingMessage::CallAccept {
                    session_id: session_id.clone(),
                    sdp_answer: answer.sdp.clone(),
                    ice_candidates: answer.candidates.clone(),
                })
                .await
                .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?;
        }
    }

    // Start audio pipeline
    let pipeline = inner.get_pipeline().await?;
    let input_id = inner.selected_input.lock().await.clone();
    let output_id = inner.selected_output.lock().await.clone();

    pipeline
        .start_capture(input_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_CAPTURE_FAILED] {}", e))?;
    pipeline
        .start_playback(output_id.as_deref())
        .await
        .map_err(|e| format!("[VOICE_CALL_AUDIO_PLAYBACK_FAILED] {}", e))?;

    // Register on_track for received audio → playback
    {
        let pipeline_clone = pipeline.clone();
        let cb: Arc<dyn Fn(Vec<u8>) + Send + Sync> = Arc::new(move |data: Vec<u8>| {
            let p = pipeline_clone.clone();
            tokio::spawn(async move {
                p.push_encoded_packet(data).await;
            });
        });
        let webrtc_guard = inner.webrtc.lock().await;
        if let Some(ref wm) = *webrtc_guard {
            wm.on_track(&session_id, cb)
                .await
                .map_err(|e| format!("[VOICE_CALL_FAILED] {e}"))?;
        }
    }

    // Update state to active
    {
        let mut sessions = inner.sessions.lock().await;
        if let Some(session) = sessions.get_mut(&session_id) {
            session.state = CallState::Active;
        }
    }

    // Emit state change to frontend
    let _ = app_handle.emit(
        "voice_call:state_change",
        CallStateChangeEvent {
            session_id: session_id.clone(),
            new_state: CallState::Active,
            reason: None,
        },
    );

    // Spawn audio send loop
    let inner_clone = inner.clone();
    let session_id_clone = session_id.clone();
    tokio::spawn(async move {
        audio_send_loop(inner_clone, &session_id_clone).await;
    });

    // Spawn ICE monitor
    let app_handle_clone = app_handle.clone();
    tokio::spawn(async move {
        monitor_ice_state(inner, &session_id, app_handle_clone).await;
    });

    Ok(())
}

#[tauri::command]
pub async fn reject_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
    reason: Option<String>,
) -> CommandResult<()> {
    let inner = service.inner.clone();

    // Send CallReject via signaling
    {
        let sig_guard = inner.signaling.lock().await;
        if let Some(ref client) = *sig_guard {
            let _ = client
                .send(&SignalingMessage::CallReject {
                    session_id: session_id.clone(),
                    reason: reason.clone(),
                })
                .await;
        }
    }

    {
        let mut sessions = inner.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
        session.state = CallState::Ended;
        session.ended_at = Some(now_secs());
    }
    inner.cleanup_session(&session_id).await;
    Ok(())
}

#[tauri::command]
pub async fn hangup_call(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<()> {
    let inner = service.inner.clone();

    let is_conference = {
        let sessions = inner.sessions.lock().await;
        sessions
            .get(&session_id)
            .map(|s| s.call_kind == CallKind::Conference)
            .unwrap_or(false)
    };

    if is_conference {
        // Send ConferenceLeave via signaling
        let user_id = inner.local_user_id.lock().await.clone().unwrap_or_default();
        let sig_guard = inner.signaling.lock().await;
        if let Some(ref client) = *sig_guard {
            let _ = client
                .send(&SignalingMessage::ConferenceLeave {
                    session_id: session_id.clone(),
                    user_id,
                })
                .await;
        }
        drop(sig_guard);

        // Clean up conference-specific resources
        let webrtc_guard = inner.webrtc.lock().await;
        if let Some(ref wm) = *webrtc_guard {
            wm.close_all_for_session(&session_id).await;
        }
        drop(webrtc_guard);

        let pipeline_guard = inner.audio_pipeline.lock().await;
        if let Some(ref p) = *pipeline_guard {
            p.disable_conference_mode();
            let _ = p.stop_capture().await;
            let _ = p.stop_playback().await;
        }
    } else {
        // Send CallHangup via signaling (P2P path)
        let sig_guard = inner.signaling.lock().await;
        if let Some(ref client) = *sig_guard {
            let _ = client
                .send(&SignalingMessage::CallHangup {
                    session_id: session_id.clone(),
                })
                .await;
        }
        drop(sig_guard);
        inner.cleanup_session(&session_id).await;
    }

    {
        let mut sessions = inner.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
        session.state = CallState::Ended;
        session.ended_at = Some(now_secs());
    }
    Ok(())
}

#[tauri::command]
pub async fn toggle_mute(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    let local_uid = service
        .inner
        .local_user_id
        .lock()
        .await
        .clone()
        .unwrap_or_default();

    let muted = {
        let mut sessions = service.inner.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
        let participant = session
            .participants
            .iter_mut()
            .find(|p| p.user_id == local_uid)
            .ok_or_else(|| {
                format!(
                    "[VOICE_CALL_FAILED] Local user not found in participants: {}",
                    local_uid
                )
            })?;
        participant.is_muted = !participant.is_muted;
        participant.is_muted
    };

    {
        let guard = service.inner.audio_pipeline.lock().await;
        if let Some(ref p) = *guard {
            p.set_mute(muted);
        }
    }

    Ok(muted)
}

#[tauri::command]
pub async fn toggle_noise_suppression(
    service: State<'_, VoiceCallService>,
    session_id: String,
) -> CommandResult<bool> {
    let ns = {
        let mut sessions = service.inner.sessions.lock().await;
        let session = sessions
            .get_mut(&session_id)
            .ok_or_else(|| format!("[VOICE_CALL_FAILED] Session not found: {}", session_id))?;
        session.media_settings.noise_suppression = !session.media_settings.noise_suppression;
        session.media_settings.noise_suppression
    };

    {
        let guard = service.inner.audio_pipeline.lock().await;
        if let Some(ref p) = *guard {
            p.set_noise_suppression(ns);
        }
    }

    Ok(ns)
}

#[tauri::command]
pub async fn enumerate_input_devices(
    service: State<'_, VoiceCallService>,
) -> CommandResult<Vec<AudioDeviceInfo>> {
    let audio = service.inner.audio.lock().await;
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
    let audio = service.inner.audio.lock().await;
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
pub async fn enumerate_audio_devices(
    service: State<'_, VoiceCallService>,
) -> CommandResult<AudioDevicesInfo> {
    let audio = service.inner.audio.lock().await;
    match audio.as_ref() {
        Some(manager) => {
            let input = manager
                .enumerate_input_devices()
                .map_err(|e| format!("[VOICE_CALL_AUDIO_DEVICE_FAILED] {}", e))?;
            let output = manager
                .enumerate_output_devices()
                .map_err(|e| format!("[VOICE_CALL_AUDIO_DEVICE_FAILED] {}", e))?;
            Ok(AudioDevicesInfo { input, output })
        }
        None => Ok(AudioDevicesInfo {
            input: Vec::new(),
            output: Vec::new(),
        }),
    }
}

#[tauri::command]
pub async fn select_input_device(
    service: State<'_, VoiceCallService>,
    _session_id: String,
    device_id: String,
) -> CommandResult<()> {
    let mut input = service.inner.selected_input.lock().await;
    *input = Some(device_id);
    Ok(())
}

#[tauri::command]
pub async fn select_output_device(
    service: State<'_, VoiceCallService>,
    _session_id: String,
    device_id: String,
) -> CommandResult<()> {
    let mut output = service.inner.selected_output.lock().await;
    *output = Some(device_id);
    Ok(())
}

// ── Video signaling relay ─────────────────────────────────────────

#[tauri::command]
pub async fn send_video_signaling(
    inner: tauri::State<'_, VoiceCallInner>,
    session_id: String,
    signal_type: String,
    payload: serde_json::Value,
) -> CommandResult<()> {
    let msg = SignalingMessage::VideoSignaling {
        session_id,
        signal_type,
        payload,
    };
    let sig = inner.signaling.lock().await;
    match sig.as_ref() {
        Some(client) => client.send(&msg).await.map_err(|e| e.to_string()),
        None => Err("[VOICE_CALL_FAILED] Signaling not connected".to_string()),
    }
}

// ── Signaling connection ────────────────────────────────────────────

#[tauri::command]
pub async fn connect_signaling(
    service: State<'_, VoiceCallService>,
    app_handle: tauri::AppHandle,
    ws_url: String,
    access_token: String,
    user_id: String,
    display_name: String,
) -> CommandResult<()> {
    let inner = service.inner.clone();

    // Store local user identity for conference messages
    *inner.local_user_id.lock().await = Some(user_id);
    *inner.local_display_name.lock().await = Some(display_name);

    let client = SignalingClient::new();
    client
        .connect(&ws_url, &access_token)
        .await
        .map_err(|e| format!("[VOICE_CALL_SIGNALING_FAILED] {e}"))?;

    *inner.signaling.lock().await = Some(client);

    // Initialize WebRTC peer manager
    *inner.webrtc.lock().await = Some(WebRtcPeerManager::new());

    // Spawn the global signaling message listener
    let inner_clone = inner.clone();
    tokio::spawn(async move {
        global_signaling_listener(inner_clone, app_handle).await;
    });

    Ok(())
}

// ── Background tasks ────────────────────────────────────────────────

/// Main signaling message dispatch loop. Receives all messages from the
/// signaling WebSocket and dispatches them to the appropriate handler.
async fn global_signaling_listener(inner: Arc<VoiceCallInner>, app_handle: tauri::AppHandle) {
    let mut disconnect_count: u32 = 0;
    const MAX_DISCONNECT_COUNT: u32 = 5;

    loop {
        let msg = {
            let sig_guard = inner.signaling.lock().await;
            match sig_guard.as_ref() {
                Some(client) => match client.recv().await {
                    Ok(Some(m)) => {
                        disconnect_count = 0;
                        m
                    }
                    Ok(None) => {
                        drop(sig_guard);
                        disconnect_count += 1;
                        if disconnect_count >= MAX_DISCONNECT_COUNT {
                            tracing::warn!(action = "app_voice_call_signaling_dead");
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(50)).await;
                        continue;
                    }
                    Err(_) => {
                        drop(sig_guard);
                        disconnect_count += 1;
                        if disconnect_count >= MAX_DISCONNECT_COUNT {
                            tracing::warn!(action = "app_voice_call_signaling_dead");
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(100)).await;
                        continue;
                    }
                },
                None => break,
            }
        };

        match msg {
            SignalingMessage::CallInvite {
                session_id,
                target_uid,
                sdp_offer,
                ice_candidates,
            } => {
                // Store SDP offer + ICE candidates for when user accepts
                {
                    let mut offers = inner.session_offers.lock().await;
                    offers.insert(session_id.clone(), sdp_offer);
                    // Store candidates in a parallel entry keyed by session_id:candidates
                    offers.insert(
                        format!("{}:candidates", session_id),
                        serde_json::to_string(&ice_candidates).unwrap_or_default(),
                    );
                }

                // Create session in ringing state
                let session = CallSession {
                    session_id: session_id.clone(),
                    call_kind: CallKind::Direct,
                    state: CallState::Ringing,
                    initiator: target_uid.clone(),
                    participants: vec![Participant {
                        user_id: target_uid.clone(),
                        display_name: String::new(),
                        is_muted: false,
                        is_speaking: false,
                        audio_level: 0.0,
                        joined_at: None,
                    }],
                    room_id: String::new(),
                    started_at: Some(now_secs()),
                    ended_at: None,
                    media_settings: empty_media_settings(),
                };

                let mut sessions = inner.sessions.lock().await;
                sessions.insert(session_id.clone(), session);

                let _ = app_handle.emit(
                    "voice_call:incoming",
                    IncomingCallEvent {
                        session_id: session_id.clone(),
                        call_kind: CallKind::Direct,
                        from_user_id: target_uid,
                        from_display_name: String::new(),
                        room_id: String::new(),
                        timestamp: now_secs(),
                    },
                );

                // Spawn timeout for ringing state
                spawn_call_timeout(inner.clone(), app_handle.clone(), session_id.clone()).await;
            }

            SignalingMessage::CallAccept {
                session_id,
                sdp_answer,
                ice_candidates,
            } => {
                // Set remote answer on the caller's peer connection
                {
                    let webrtc_guard = inner.webrtc.lock().await;
                    if let Some(ref wm) = *webrtc_guard {
                        let _ = wm.set_remote_answer(&session_id, &sdp_answer).await;
                        for c in &ice_candidates {
                            let _ = wm.add_remote_candidate(&session_id, c).await;
                        }
                    }
                }

                // Update session state to active
                let mut sessions = inner.sessions.lock().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = CallState::Active;
                }

                let _ = app_handle.emit(
                    "voice_call:state_change",
                    CallStateChangeEvent {
                        session_id: session_id.clone(),
                        new_state: CallState::Active,
                        reason: None,
                    },
                );

                // Spawn audio send loop for caller
                let inner_clone = inner.clone();
                let sid = session_id.clone();
                let ah = app_handle.clone();
                tokio::spawn(async move {
                    audio_send_loop(inner_clone, &sid).await;
                });

                // Spawn ICE monitor for caller
                let inner_clone2 = inner.clone();
                tokio::spawn(async move {
                    monitor_ice_state(inner_clone2, &session_id, ah).await;
                });
            }

            SignalingMessage::CallReject { session_id, reason } => {
                let mut sessions = inner.sessions.lock().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = CallState::Ended;
                    s.ended_at = Some(now_secs());
                }
                let _ = app_handle.emit(
                    "voice_call:state_change",
                    CallStateChangeEvent {
                        session_id,
                        new_state: CallState::Ended,
                        reason,
                    },
                );
            }

            SignalingMessage::CallHangup { session_id } => {
                let mut sessions = inner.sessions.lock().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = CallState::Ended;
                    s.ended_at = Some(now_secs());
                }
                let _ = app_handle.emit(
                    "voice_call:state_change",
                    CallStateChangeEvent {
                        session_id,
                        new_state: CallState::Ended,
                        reason: Some("remote_hangup".to_string()),
                    },
                );
            }

            SignalingMessage::IceCandidate {
                session_id,
                candidate,
                sdp_mid,
                sdp_mline_index,
            } => {
                let webrtc_guard = inner.webrtc.lock().await;
                if let Some(ref wm) = *webrtc_guard {
                    let _ = wm.add_remote_candidate(&session_id, &candidate).await;
                }
                let _ = (sdp_mid, sdp_mline_index);
            }

            // ── Conference message handlers ──────────────────────
            SignalingMessage::ConferenceJoin {
                session_id,
                user_id,
                display_name,
            } => {
                // Add joiner to session participants
                let initiator_id = {
                    let mut sessions = inner.sessions.lock().await;
                    if let Some(s) = sessions.get_mut(&session_id) {
                        let participant = Participant {
                            user_id: user_id.clone(),
                            display_name: display_name.clone(),
                            is_muted: false,
                            is_speaking: false,
                            audio_level: 0.0,
                            joined_at: Some(now_secs()),
                        };
                        s.participants.push(participant);
                        s.initiator.clone()
                    } else {
                        String::new()
                    }
                };
                if initiator_id.is_empty() {
                    return; // session not found, skip
                }

                // Register joiner in audio pipeline
                if let Some(ref p) = *inner.audio_pipeline.lock().await {
                    let _ = p.register_participant(&user_id);
                }

                // Create WebRTC offer for joiner (initiator → joiner)
                let offer = {
                    let webrtc_guard = inner.webrtc.lock().await;
                    if let Some(ref wm) = *webrtc_guard {
                        match wm.create_offer_for(&session_id, &user_id).await {
                            Ok(o) => Some(o),
                            Err(e) => {
                                tracing::warn!(action = "app_voice_call_conf_offer_failed", error = %e);
                                None
                            }
                        }
                    } else {
                        None
                    }
                };

                // Send offer to joiner via signaling
                if let Some(offer) = offer
                    && let Some(ref client) = *inner.signaling.lock().await
                {
                    let _ = client
                        .send(&SignalingMessage::ConferenceSdpOffer {
                            session_id: session_id.clone(),
                            target_user_id: user_id.clone(),
                            sdp_offer: offer.sdp,
                            ice_candidates: offer.candidates,
                        })
                        .await;
                }

                // Register on_track for joiner's audio → push to pipeline
                {
                    let pipeline_arc = {
                        let guard = inner.audio_pipeline.lock().await;
                        guard.as_ref().cloned()
                    };
                    if let Some(pipeline) = pipeline_arc {
                        let pid = user_id.clone();
                        let cb: Arc<dyn Fn(Vec<u8>) + Send + Sync> =
                            Arc::new(move |data: Vec<u8>| {
                                pipeline.push_participant_packet(&pid, data);
                            });
                        let webrtc_guard = inner.webrtc.lock().await;
                        if let Some(ref wm) = *webrtc_guard {
                            let _ = wm.on_track_from(&session_id, &user_id, cb).await;
                        }
                    }
                }

                // Send ack to joiner with full participant list
                let sessions = inner.sessions.lock().await;
                let participants = sessions
                    .get(&session_id)
                    .map(|s| s.participants.clone())
                    .unwrap_or_default();

                // Emit participant update to frontend (before moving participants)
                let _ = app_handle.emit(
                    "voice_call:participant_update",
                    serde_json::json!({
                        "sessionId": &session_id,
                        "action": "joined",
                        "participant": {
                            "userId": &user_id,
                            "displayName": &display_name,
                            "isMuted": false,
                            "isSpeaking": false,
                            "audioLevel": 0.0,
                            "joinedAt": now_secs(),
                        },
                        "participants": &participants,
                    }),
                );

                if let Some(ref client) = *inner.signaling.lock().await {
                    let _ = client
                        .send(&SignalingMessage::ConferenceJoinAck {
                            session_id: session_id.clone(),
                            user_id: user_id.clone(),
                            participants,
                        })
                        .await;
                }
            }

            SignalingMessage::ConferenceSdpAnswer {
                session_id,
                target_user_id,
                sdp_answer,
                ice_candidates,
            } => {
                let webrtc_guard = inner.webrtc.lock().await;
                if let Some(ref wm) = *webrtc_guard {
                    let _ = wm
                        .set_remote_answer_for(&session_id, &target_user_id, &sdp_answer)
                        .await;
                    for c in &ice_candidates {
                        let _ = wm
                            .add_remote_candidate_for(&session_id, &target_user_id, c)
                            .await;
                    }
                }

                // Register on_track for initiator's audio (joiner side)
                {
                    let pipeline_arc = {
                        let guard = inner.audio_pipeline.lock().await;
                        guard.as_ref().cloned()
                    };
                    if let Some(pipeline) = pipeline_arc {
                        let pid = target_user_id.clone();
                        let cb: Arc<dyn Fn(Vec<u8>) + Send + Sync> =
                            Arc::new(move |data: Vec<u8>| {
                                pipeline.push_participant_packet(&pid, data);
                            });
                        if let Some(ref wm) = *inner.webrtc.lock().await {
                            let _ = wm.on_track_from(&session_id, &target_user_id, cb).await;
                        }
                    }
                }

                // Update joiner's local state to Active
                let mut sessions = inner.sessions.lock().await;
                if let Some(s) = sessions.get_mut(&session_id) {
                    s.state = CallState::Active;
                }

                let sid_clone = session_id.clone();
                let _ = app_handle.emit(
                    "voice_call:state_change",
                    CallStateChangeEvent {
                        session_id,
                        new_state: CallState::Active,
                        reason: None,
                    },
                );

                // Spawn audio send loop for joiner
                let inner_clone = inner.clone();
                tokio::spawn(async move {
                    audio_send_loop_conference(inner_clone, &sid_clone).await;
                });
            }

            SignalingMessage::ConferenceLeave {
                session_id,
                user_id,
            } => {
                // Remove from participant list
                let remaining: Vec<Participant> = {
                    let mut sessions = inner.sessions.lock().await;
                    if let Some(s) = sessions.get_mut(&session_id) {
                        s.participants.retain(|p| p.user_id != user_id);
                        let participants = s.participants.clone();
                        if participants.is_empty() {
                            s.state = CallState::Ended;
                            s.ended_at = Some(now_secs());
                        }
                        participants
                    } else {
                        Vec::new()
                    }
                };

                // Cleanup WebRTC + audio for this participant
                {
                    let webrtc_guard = inner.webrtc.lock().await;
                    if let Some(ref wm) = *webrtc_guard {
                        let _ = wm.close_peer_connection_for(&session_id, &user_id).await;
                    }
                }
                if let Some(ref p) = *inner.audio_pipeline.lock().await {
                    p.unregister_participant(&user_id);
                }

                // Emit participant update
                let _ = app_handle.emit(
                    "voice_call:participant_update",
                    serde_json::json!({
                        "sessionId": session_id.clone(),
                        "action": "left",
                        "userId": user_id,
                        "participants": remaining,
                    }),
                );

                // End session if empty
                if remaining.is_empty() {
                    let _ = app_handle.emit(
                        "voice_call:state_change",
                        CallStateChangeEvent {
                            session_id,
                            new_state: CallState::Ended,
                            reason: Some("all_left".to_string()),
                        },
                    );
                }
            }

            // Joiner receives offer → create answer → send back
            SignalingMessage::ConferenceSdpOffer {
                session_id,
                target_user_id,
                sdp_offer,
                ice_candidates,
            } => {
                let answer = {
                    let webrtc_guard = inner.webrtc.lock().await;
                    if let Some(ref wm) = *webrtc_guard {
                        wm.create_answer_for(&session_id, &target_user_id, &sdp_offer)
                            .await
                            .ok()
                    } else {
                        None
                    }
                };

                // Add ICE candidates from the offer after peer connection is created
                if answer.is_some() {
                    let webrtc_guard = inner.webrtc.lock().await;
                    if let Some(ref wm) = *webrtc_guard {
                        for c in &ice_candidates {
                            let _ = wm
                                .add_remote_candidate_for(&session_id, &target_user_id, c)
                                .await;
                        }
                    }
                }

                if let Some(answer) = answer
                    && let Some(ref client) = *inner.signaling.lock().await
                {
                    let _ = client
                        .send(&SignalingMessage::ConferenceSdpAnswer {
                            session_id,
                            target_user_id,
                            sdp_answer: answer.sdp,
                            ice_candidates: answer.candidates,
                        })
                        .await;
                }
            }

            // Joiner receives ack — returns immediately; state changes are driven
            // by the ConferenceSdpAnswer handler and participant_update events.
            SignalingMessage::ConferenceJoinAck { .. } => {}
            SignalingMessage::VideoSignaling {
                session_id,
                signal_type,
                payload,
            } => {
                let _ = app_handle.emit(
                    "voice_call:video_signaling",
                    serde_json::json!({
                        "sessionId": session_id,
                        "signalType": signal_type,
                        "payload": payload,
                    }),
                );
            }
        }
    }

    // ── Cleanup on disconnect ─────────────────────────────────────
    tracing::warn!(action = "app_voice_call_signaling_cleanup_start");

    // Mark signaling as disconnected
    {
        let mut sig = inner.signaling.lock().await;
        if let Some(ref client) = *sig {
            client.disconnect().await;
        }
        *sig = None;
    }

    // Close all WebRTC connections
    {
        let mut webrtc = inner.webrtc.lock().await;
        if let Some(ref wm) = *webrtc {
            let sessions: Vec<String> = {
                let s = inner.sessions.lock().await;
                s.keys().cloned().collect()
            };
            for sid in &sessions {
                wm.close_all_for_session(sid).await;
            }
        }
        *webrtc = None;
    }

    // End all sessions and notify frontend
    {
        let mut sessions = inner.sessions.lock().await;
        for (sid, session) in sessions.iter_mut() {
            session.state = CallState::Ended;
            session.ended_at = Some(now_secs());
            let _ = app_handle.emit(
                "voice_call:state_change",
                CallStateChangeEvent {
                    session_id: sid.clone(),
                    new_state: CallState::Ended,
                    reason: Some("signaling_disconnected".to_string()),
                },
            );
        }
        sessions.clear();
    }

    // Stop audio pipeline
    {
        let pipeline_guard = inner.audio_pipeline.lock().await;
        if let Some(ref p) = *pipeline_guard {
            p.disable_conference_mode();
            let _ = p.stop_capture().await;
            let _ = p.stop_playback().await;
        }
    }

    tracing::warn!(action = "app_voice_call_signaling_cleanup_complete");
}

/// Periodically sends encoded Opus packets from the audio pipeline
/// through the WebRTC peer connection.
async fn audio_send_loop(inner: Arc<VoiceCallInner>, session_id: &str) {
    loop {
        let packets = {
            let pipeline_guard = inner.audio_pipeline.lock().await;
            match pipeline_guard.as_ref() {
                Some(p) => p.take_encoded_packets().await,
                None => break,
            }
        };

        if !packets.is_empty() {
            let webrtc_guard = inner.webrtc.lock().await;
            if let Some(ref wm) = *webrtc_guard {
                for pkt in &packets {
                    if wm.send_audio(session_id, pkt).await.is_err() {
                        break;
                    }
                }
            } else {
                break;
            }
        }

        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

/// Conference variant: sends captured audio to all connected participants.
async fn audio_send_loop_conference(inner: Arc<VoiceCallInner>, session_id: &str) {
    loop {
        let packets = {
            let pipeline_guard = inner.audio_pipeline.lock().await;
            match pipeline_guard.as_ref() {
                Some(p) => p.take_encoded_packets().await,
                None => break,
            }
        };

        if !packets.is_empty() {
            let participant_ids = {
                let webrtc_guard = inner.webrtc.lock().await;
                match webrtc_guard.as_ref() {
                    Some(wm) => wm.get_participant_ids(session_id).await,
                    None => Vec::new(),
                }
            };

            let webrtc_guard = inner.webrtc.lock().await;
            if let Some(ref wm) = *webrtc_guard {
                for pkt in &packets {
                    for pid in &participant_ids {
                        if wm.send_audio_to(session_id, pid, pkt).await.is_err() {
                            break;
                        }
                    }
                }
            } else {
                break;
            }
        }

        tokio::time::sleep(Duration::from_millis(20)).await;
    }
}

/// Monitors ICE connection state for a session and emits events to the
/// frontend when the state changes.
async fn monitor_ice_state(
    inner: Arc<VoiceCallInner>,
    session_id: &str,
    app_handle: tauri::AppHandle,
) {
    let mut rx = {
        let webrtc_guard = inner.webrtc.lock().await;
        match webrtc_guard.as_ref() {
            Some(wm) => match wm.ice_state_rx(session_id).await {
                Ok(r) => r,
                Err(_) => return,
            },
            None => return,
        }
    };

    while let Ok(()) = rx.changed().await {
        let state = rx.borrow().clone();
        let _ = app_handle.emit(
            "voice_call:ice_state",
            serde_json::json!({
                "sessionId": session_id,
                "state": state,
            }),
        );
        if state == "failed" || state == "closed" || state == "disconnected" {
            break;
        }
    }
}
