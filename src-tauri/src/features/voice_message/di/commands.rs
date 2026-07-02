//! voice_message｜Tauri 命令实现。
//!
//! 提供以下 IPC 命令：
//! - `start_voice_recording`：开始语音录制
//! - `stop_voice_recording`：停止录制并返回 WAV 文件信息
//! - `read_file_base64`：读取文件内容并返回 Base64 编码（供前端上传用）
//!
//! 约定：注释中文，日志英文（tracing）。

use std::io::SeekFrom;
use std::sync::Mutex;

use tauri::State;
use tokio::io::{AsyncReadExt, AsyncSeekExt};

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

/// 分块读取文件并返回 Base64 编码片段的响应。
#[derive(serde::Serialize)]
pub struct FileBase64ChunkResponse {
    /// Base64 编码的文件片段。
    pub chunk: String,
    /// 本次实际读取的字节数。
    pub read_bytes: u64,
    /// 文件总字节数。
    pub total_bytes: u64,
    /// 是否已读到文件末尾。
    pub eof: bool,
}

/// 分块读取文件内容并以 Base64 字符串返回。
///
/// 用于避免大文件一次性读入前端内存；前端可循环调用拼接为 Blob。
#[tauri::command]
pub async fn read_file_base64_chunk(
    path: String,
    offset: u64,
    length: u64,
) -> CommandResult<FileBase64ChunkResponse> {
    const MAX_CHUNK_SIZE: u64 = 256 * 1024;
    let length = length.min(MAX_CHUNK_SIZE);

    let mut file = tokio::fs::File::open(&path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    let total_bytes = file
        .metadata()
        .await
        .map_err(|e| format!("Failed to read file metadata: {}", e))?
        .len();

    if offset > total_bytes {
        return Ok(FileBase64ChunkResponse {
            chunk: String::new(),
            read_bytes: 0,
            total_bytes,
            eof: true,
        });
    }

    file.seek(SeekFrom::Start(offset))
        .await
        .map_err(|e| format!("Failed to seek file: {}", e))?;

    let mut buf = vec![0u8; length as usize];
    let read_bytes = file
        .read(&mut buf)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    buf.truncate(read_bytes);

    let eof = offset.saturating_add(read_bytes as u64) >= total_bytes;
    Ok(FileBase64ChunkResponse {
        chunk: base64_encode(&buf),
        read_bytes: read_bytes as u64,
        total_bytes,
        eof,
    })
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn read_file_base64_chunk_reads_partial_and_eof() {
        let dir = std::env::temp_dir().join("cp-test-read-chunk");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("sample.bin");
        std::fs::write(&path, b"hello world").unwrap();

        let res = read_file_base64_chunk(
            path.to_string_lossy().into_owned(),
            0,
            4,
        )
        .await
        .unwrap();

        assert_eq!(res.read_bytes, 4);
        assert_eq!(res.total_bytes, 11);
        assert!(!res.eof);
        assert_eq!(res.chunk, base64_encode(b"hell"));

        let res2 = read_file_base64_chunk(
            path.to_string_lossy().into_owned(),
            6,
            1024,
        )
        .await
        .unwrap();

        assert_eq!(res2.read_bytes, 5);
        assert!(res2.eof);
        assert_eq!(res2.chunk, base64_encode(b"world"));
    }

    #[tokio::test]
    async fn read_file_base64_chunk_offset_beyond_eof_returns_empty() {
        let dir = std::env::temp_dir().join("cp-test-read-chunk-empty");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("empty.bin");
        std::fs::write(&path, b"x").unwrap();

        let res = read_file_base64_chunk(
            path.to_string_lossy().into_owned(),
            100,
            4,
        )
        .await
        .unwrap();

        assert_eq!(res.read_bytes, 0);
        assert!(res.eof);
        assert!(res.chunk.is_empty());
    }
}
