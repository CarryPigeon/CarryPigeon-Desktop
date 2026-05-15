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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallKind {
    Direct,
    Conference,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
pub struct AudioDeviceInfo {
    pub device_id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub buffer_size: usize,
}
