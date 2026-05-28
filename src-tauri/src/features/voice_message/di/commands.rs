//! voice_message｜Tauri 命令实现。
//!
//! 提供以下 IPC 命令：
//! - `start_voice_recording`：开始语音录制
//! - `stop_voice_recording`：停止录制并返回 WAV 文件信息
//! - `read_file_base64`：读取文件内容并返回 Base64 编码（供前端上传用）
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::Mutex;

use tauri::State;

use crate::features::voice_message::recorder::{RecordingResult, VoiceRecorder};
use crate::shared::error::CommandResult;

/// Tauri 托管的录制器状态。
pub struct VoiceRecorderState(pub Mutex<Option<VoiceRecorder>>);

/// 开始语音录制。
///
/// 使用默认输入设备以 48kHz 单声道录制 PCM，保存为 WAV 文件。
#[tauri::command]
pub async fn start_voice_recording(
    recorder_state: State<'_, VoiceRecorderState>,
) -> CommandResult<()> {
    let temp_dir = std::env::temp_dir().join("carrypigeon-voice");
    let recorder = VoiceRecorder::start(temp_dir).map_err(|e| e.to_string())?;
    *recorder_state.0.lock().map_err(|e| e.to_string())? = Some(recorder);
    tracing::info!(action = "app_voice_message_recording_started");
    Ok(())
}

/// 停止语音录制并获取录制结果。
#[tauri::command]
pub async fn stop_voice_recording(
    recorder_state: State<'_, VoiceRecorderState>,
) -> CommandResult<VoiceRecordingResult> {
    let mut guard = recorder_state.0.lock().map_err(|e| e.to_string())?;
    let mut recorder = guard.take().ok_or("No active recording")?;
    let result = recorder.stop().map_err(|e| e.to_string())?;
    let recording: VoiceRecordingResult = result.into();
    tracing::info!(
        action = "app_voice_message_recording_stopped",
        duration_ms = recording.duration_ms,
        size_bytes = recording.size_bytes
    );
    Ok(recording)
}

/// 读取文件内容并以 Base64 字符串返回（供前端下载/上传）。
#[tauri::command]
pub async fn read_file_base64(path: String) -> CommandResult<String> {
    let data = std::fs::read(&path).map_err(|e| format!("Failed to read file: {}", e))?;
    Ok(base64_encode(&data))
}

/// 录制结果（JSON 序列化用）。
#[derive(serde::Serialize)]
pub struct VoiceRecordingResult {
    /// WAV 文件绝对路径。
    pub file_path: String,
    /// 录制时长（毫秒）。
    pub duration_ms: u64,
    /// 文件大小（字节）。
    pub size_bytes: u64,
}

impl From<RecordingResult> for VoiceRecordingResult {
    fn from(r: RecordingResult) -> Self {
        Self {
            file_path: r.file_path.to_string_lossy().into(),
            duration_ms: r.duration_ms,
            size_bytes: r.size_bytes,
        }
    }
}

/// 最小化 Base64 编码实现（无需额外依赖）。
fn base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = chunk.get(1).copied().unwrap_or(0) as u32;
        let b2 = chunk.get(2).copied().unwrap_or(0) as u32;
        let triple = (b0 << 16) | (b1 << 8) | b2;
        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}
