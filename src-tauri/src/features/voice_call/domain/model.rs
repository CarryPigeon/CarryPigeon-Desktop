use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallSession {
    pub session_id: String,
    pub call_kind: CallKind,
    pub state: CallState,
    pub initiator: String,
    pub participants: Vec<Participant>,
    pub room_id: String,
    pub started_at: Option<u64>,
    pub ended_at: Option<u64>,
    pub media_settings: MediaSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CallKind {
    Direct,
    Conference,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CallState {
    Idle,
    Dialing,
    Ringing,
    Connecting,
    Active,
    Ended,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participant {
    pub user_id: String,
    pub display_name: String,
    pub is_muted: bool,
    pub is_speaking: bool,
    pub audio_level: f64,
    pub joined_at: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaSettings {
    pub input_device_id: Option<String>,
    pub output_device_id: Option<String>,
    pub noise_suppression: bool,
    pub echo_cancellation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub device_id: String,
    pub name: String,
    pub is_default: bool,
}

/// Combined result of enumerating audio devices (input + output).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevicesInfo {
    pub input: Vec<AudioDeviceInfo>,
    pub output: Vec<AudioDeviceInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}

/// SDP + candidates bundle from offer/answer creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfferData {
    pub sdp: String,
    pub candidates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerData {
    pub sdp: String,
    pub candidates: Vec<String>,
}

/// ICE candidate received from remote peer via signaling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteIceCandidate {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    pub sdp_mline_index: Option<u16>,
}

/// Signaling message envelope for SDP/ICE relay
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SignalingMessage {
    CallInvite {
        session_id: String,
        target_uid: String,
        sdp_offer: String,
        ice_candidates: Vec<String>,
    },
    CallAccept {
        session_id: String,
        sdp_answer: String,
        ice_candidates: Vec<String>,
    },
    CallReject {
        session_id: String,
        reason: Option<String>,
    },
    CallHangup {
        session_id: String,
    },
    IceCandidate {
        session_id: String,
        candidate: String,
        sdp_mid: Option<String>,
        sdp_mline_index: Option<u16>,
    },
    // ── Conference (SFU‑ready) ──────────────────────────────
    ConferenceJoin {
        session_id: String,
        user_id: String,
        display_name: String,
    },
    ConferenceJoinAck {
        session_id: String,
        user_id: String,
        participants: Vec<Participant>,
    },
    ConferenceSdpOffer {
        session_id: String,
        target_user_id: String,
        sdp_offer: String,
        ice_candidates: Vec<String>,
    },
    ConferenceSdpAnswer {
        session_id: String,
        target_user_id: String,
        sdp_answer: String,
        ice_candidates: Vec<String>,
    },
    ConferenceLeave {
        session_id: String,
        user_id: String,
    },
    /// Generic container for video/screen-signaling SDP/ICE payloads.
    /// Opaque to Rust — the relay forwards JSON without inspecting fields.
    VideoSignaling {
        session_id: String,
        signal_type: String,
        payload: serde_json::Value,
    },
}

/// ICE connection state for UI feedback
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IceConnectionState {
    New,
    Checking,
    Connected,
    Completed,
    Failed,
    Disconnected,
    Closed,
}
