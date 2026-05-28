//! voice_message｜语音录制器（VoiceRecorder）。
//!
//! 通过 cpal 采集麦克风 PCM f32 数据，在停止时写入标准 WAV 文件（48kHz 单声道 16-bit PCM）。
//! 使用 `std::sync::mpsc` 通道通知后台线程停止录制。

use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, mpsc};
use std::time::Instant;

use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

/// 采样率（Hz）。
const SAMPLE_RATE: u32 = 48000;
/// 声道数。
const CHANNELS: u16 = 1;

/// 录制结果。
pub struct RecordingResult {
    /// WAV 文件路径。
    pub file_path: PathBuf,
    /// 录制时长（毫秒）。
    pub duration_ms: u64,
    /// 文件大小（字节）。
    pub size_bytes: u64,
}

/// 录制控制命令。
enum RecorderCommand {
    Stop,
}

/// 语音录制器。
///
/// # 示例
///
/// ```ignore
/// let mut recorder = VoiceRecorder::start(temp_dir)?;
/// // ... 录制中 ...
/// let result = recorder.stop()?;
/// // Handle result.file_path, result.duration_ms, result.size_bytes
/// ```
pub struct VoiceRecorder {
    command_tx: Option<mpsc::Sender<RecorderCommand>>,
    result: Arc<Mutex<Option<RecordingResult>>>,
}

impl VoiceRecorder {
    /// 开始录制。
    ///
    /// # 参数
    /// - `temp_dir`：存放录制 WAV 文件的目录（会自动创建）。
    ///
    /// # 返回值
    /// 录制器实例，调用 `stop()` 获取结果。
    pub fn start(temp_dir: PathBuf) -> Result<Self> {
        // 确保临时目录存在
        std::fs::create_dir_all(&temp_dir).context("VOICE_MESSAGE_TEMP_DIR_FAILED")?;

        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .context("VOICE_MESSAGE_NO_INPUT_DEVICE")?;

        let supported_config = device
            .default_input_config()
            .context("VOICE_MESSAGE_NO_INPUT_CONFIG")?;
        let config: cpal::StreamConfig = supported_config.into();

        // 生成唯一文件名（基于时间戳）
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let file_path = temp_dir.join(format!("voice_msg_{}.wav", timestamp));

        // PCM 样本缓冲区（f32）
        let pcm_buffer: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));
        let pcm_buffer_clone = pcm_buffer.clone();

        // 控制通道
        let (cmd_tx, cmd_rx) = mpsc::channel::<RecorderCommand>();
        let result: Arc<Mutex<Option<RecordingResult>>> = Arc::new(Mutex::new(None));
        let result_clone = result.clone();
        let start_time = Instant::now();

        // 构建音频输入流
        let stream = device
            .build_input_stream(
                &config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // 累积 PCM 样本
                    if let Ok(mut buf) = pcm_buffer_clone.lock() {
                        buf.extend_from_slice(data);
                    }
                },
                move |err| {
                    tracing::error!(
                        action = "app_voice_message_capture_error",
                        error = %err
                    );
                },
                None,
            )
            .context("VOICE_MESSAGE_BUILD_STREAM_FAILED")?;

        stream.play().context("VOICE_MESSAGE_STREAM_PLAY_FAILED")?;

        // 后台线程：等待停止命令，完成后写入 WAV 文件
        std::thread::spawn(move || {
            if let Ok(RecorderCommand::Stop) = cmd_rx.recv() {
                // 丢弃流以停止采集
                drop(stream);
                let duration = start_time.elapsed();

                // 锁定缓冲区并写入 WAV
                let write_result = Self::write_wav(&pcm_buffer, &file_path);
                match write_result {
                    Ok(size) => {
                        if let Ok(mut guard) = result_clone.lock() {
                            *guard = Some(RecordingResult {
                                file_path,
                                duration_ms: duration.as_millis() as u64,
                                size_bytes: size,
                            });
                        } else {
                            tracing::error!(action = "app_voice_message_result_lock_failed");
                        }
                    }
                    Err(e) => {
                        tracing::error!(
                            action = "app_voice_message_wav_write_failed",
                            error = %e
                        );
                    }
                }
            }
        });

        Ok(Self {
            command_tx: Some(cmd_tx),
            result,
        })
    }

    /// 停止录制并返回结果。
    ///
    /// # 返回值
    /// 录制结果（文件路径、时长、大小）。
    pub fn stop(&mut self) -> Result<RecordingResult> {
        if let Some(tx) = self.command_tx.take() {
            let _ = tx.send(RecorderCommand::Stop);
        }
        // 等待后台线程完成 WAV 写入
        std::thread::sleep(std::time::Duration::from_millis(300));
        self.result
            .lock()
            .map_err(|e| anyhow::anyhow!("lock failure: {}", e))?
            .take()
            .context("VOICE_MESSAGE_RESULT_UNAVAILABLE")
    }

    /// 将 PCM f32 缓冲区写入标准 WAV 文件（16-bit PCM）。
    ///
    /// # 参数
    /// - `buffer`：PCM f32 样本缓冲区（值域 [-1.0, 1.0]）。
    /// - `path`：输出 WAV 文件路径。
    ///
    /// # 返回值
    /// 写入的字节数。
    fn write_wav(buffer: &Mutex<Vec<f32>>, path: &PathBuf) -> std::io::Result<u64> {
        let samples = buffer.lock().map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("Lock error: {}", e))
        })?;

        let num_samples = samples.len() as u32;
        let bytes_per_sample: u16 = 2; // 16-bit
        let byte_rate = SAMPLE_RATE * CHANNELS as u32 * bytes_per_sample as u32;
        let block_align = CHANNELS * bytes_per_sample;
        let data_size = num_samples * bytes_per_sample as u32;
        // RIFF header (12) + fmt chunk (24) + data chunk header (8) + data
        let file_size = 44; // Standard PCM WAV header size

        let mut file = File::create(path)?;

        // RIFF header
        file.write_all(b"RIFF")?;
        file.write_all(&(file_size + data_size - 8).to_le_bytes())?; // File size - 8
        file.write_all(b"WAVE")?;

        // fmt chunk
        file.write_all(b"fmt ")?;
        file.write_all(&16u32.to_le_bytes())?; // Chunk size
        file.write_all(&1u16.to_le_bytes())?; // Audio format: PCM
        file.write_all(&CHANNELS.to_le_bytes())?;
        file.write_all(&SAMPLE_RATE.to_le_bytes())?;
        file.write_all(&byte_rate.to_le_bytes())?;
        file.write_all(&block_align.to_le_bytes())?;
        file.write_all(&(bytes_per_sample * 8).to_le_bytes())?; // Bits per sample

        // data chunk
        file.write_all(b"data")?;
        file.write_all(&data_size.to_le_bytes())?;

        // Write PCM samples (f32 -> i16)
        for &sample in samples.iter() {
            let clamped = sample.clamp(-1.0, 1.0);
            let int_sample = (clamped * 32767.0) as i16;
            file.write_all(&int_sample.to_le_bytes())?;
        }

        let size = file.metadata()?.len();
        Ok(size)
    }
}
