use serde::Serialize;
use super::super::domain::model::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomingCallEvent {
    pub session_id: String,
    pub call_kind: CallKind,
    pub from_user_id: String,
    pub from_display_name: String,
    pub room_id: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CallStateChangeEvent {
    pub session_id: String,
    pub new_state: CallState,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantUpdateEvent {
    pub session_id: String,
    pub action: String,
    pub participant: Participant,
    pub participants: Vec<Participant>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakingStateEvent {
    pub session_id: String,
    pub speaker_updates: Vec<SpeakerUpdate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeakerUpdate {
    pub user_id: String,
    pub is_speaking: bool,
    pub audio_level: f64,
}
