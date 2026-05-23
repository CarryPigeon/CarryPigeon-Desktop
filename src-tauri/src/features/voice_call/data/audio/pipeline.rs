use anyhow::Context;
use cpal::Stream;
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use opus_wave::{Application, Channels, OpusDecoder, OpusEncoder, SampleRate};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex as TokioMutex;
use tracing::{info, warn};

const FRAME_SIZE: usize = 960; // 20ms at 48kHz
const MAX_PACKET: usize = 4000;

pub struct AudioPipeline {
    pub encoder: Arc<TokioMutex<OpusEncoder>>,
    pub decoder: Arc<TokioMutex<OpusDecoder>>,
    pub capture_stream: TokioMutex<Option<Stream>>,
    pub playback_stream: TokioMutex<Option<Stream>>,
    pub encoded_out: Arc<TokioMutex<Vec<Vec<u8>>>>,
    pub encoded_in: Arc<TokioMutex<Vec<Vec<u8>>>>,
    pub muted: Arc<AtomicBool>,
    pub noise_suppression: Arc<AtomicBool>,
    capture_leftover: Arc<std::sync::Mutex<Vec<f32>>>,

    // Conference multi-participant fields
    pub conference_mode: Arc<AtomicBool>,
    participant_decoders: Arc<std::sync::Mutex<HashMap<String, OpusDecoder>>>,
    participant_buffers: Arc<std::sync::Mutex<HashMap<String, Vec<Vec<u8>>>>>,
}

impl AudioPipeline {
    pub fn new() -> anyhow::Result<Self> {
        let encoder = OpusEncoder::new(SampleRate::Hz48000, Channels::Mono, Application::Voip)
            .context("VOICE_CALL_AUDIO_ENCODE_FAILED")?;

        let decoder = OpusDecoder::new(SampleRate::Hz48000, Channels::Mono)
            .context("VOICE_CALL_AUDIO_DECODE_FAILED")?;

        Ok(Self {
            encoder: Arc::new(TokioMutex::new(encoder)),
            decoder: Arc::new(TokioMutex::new(decoder)),
            capture_stream: TokioMutex::new(None),
            playback_stream: TokioMutex::new(None),
            encoded_out: Arc::new(TokioMutex::new(Vec::new())),
            encoded_in: Arc::new(TokioMutex::new(Vec::new())),
            muted: Arc::new(AtomicBool::new(false)),
            noise_suppression: Arc::new(AtomicBool::new(false)),
            capture_leftover: Arc::new(std::sync::Mutex::new(Vec::new())),
            conference_mode: Arc::new(AtomicBool::new(false)),
            participant_decoders: Arc::new(std::sync::Mutex::new(HashMap::new())),
            participant_buffers: Arc::new(std::sync::Mutex::new(HashMap::new())),
        })
    }

    pub async fn start_capture(&self, device_id: Option<&str>) -> anyhow::Result<()> {
        let host = cpal::default_host();
        let device = if let Some(id) = device_id {
            host.input_devices()
                .context("VOICE_CALL_AUDIO_CAPTURE_FAILED")?
                .find(|d| {
                    d.id()
                        .ok()
                        .map(|did| did.to_string() == id)
                        .unwrap_or(false)
                })
        } else {
            host.default_input_device()
        }
        .context("VOICE_CALL_AUDIO_CAPTURE_FAILED: no input device")?;

        let config = device
            .default_input_config()
            .context("VOICE_CALL_AUDIO_CAPTURE_FAILED: no default input config")?;

        let muted = self.muted.clone();
        let noise_suppression = self.noise_suppression.clone();
        let encoder = self.encoder.clone();
        let encoded_out = self.encoded_out.clone();
        let leftover = self.capture_leftover.clone();

        let stream: cpal::Stream = match config.sample_format() {
            cpal::SampleFormat::F32 => device
                .build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        process_capture(
                            data,
                            &muted,
                            &noise_suppression,
                            &encoder,
                            &encoded_out,
                            &leftover,
                        );
                    },
                    |err| warn!(action = "app_voice_call_capture_error", error = %err),
                    None,
                )
                .context("VOICE_CALL_AUDIO_CAPTURE_FAILED: build_input_stream")?,
            _ => anyhow::bail!(
                "VOICE_CALL_AUDIO_CAPTURE_FAILED: unsupported sample format, expected F32"
            ),
        };

        stream
            .play()
            .context("VOICE_CALL_AUDIO_CAPTURE_FAILED: play")?;

        *self.capture_stream.lock().await = Some(stream);
        self.encoded_out.lock().await.clear();
        if let Ok(mut leftover) = self.capture_leftover.lock() {
            leftover.clear();
        }
        info!(action = "app_voice_call_capture_started");
        Ok(())
    }

    pub async fn start_playback(&self, device_id: Option<&str>) -> anyhow::Result<()> {
        let host = cpal::default_host();
        let device = if let Some(id) = device_id {
            host.output_devices()
                .context("VOICE_CALL_AUDIO_PLAYBACK_FAILED")?
                .find(|d| {
                    d.id()
                        .ok()
                        .map(|did| did.to_string() == id)
                        .unwrap_or(false)
                })
        } else {
            host.default_output_device()
        }
        .context("VOICE_CALL_AUDIO_PLAYBACK_FAILED: no output device")?;

        let config = device
            .default_output_config()
            .context("VOICE_CALL_AUDIO_PLAYBACK_FAILED: no default output config")?;

        let stream_config: cpal::StreamConfig = config.into();

        let decoder = self.decoder.clone();
        let encoded_in = self.encoded_in.clone();
        let conference_mode = self.conference_mode.clone();
        let participant_decoders = self.participant_decoders.clone();
        let participant_buffers = self.participant_buffers.clone();

        let stream = device
            .build_output_stream(
                &stream_config,
                move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
                    process_playback(
                        data,
                        &decoder,
                        &encoded_in,
                        &conference_mode,
                        &participant_decoders,
                        &participant_buffers,
                    );
                },
                |err| warn!(action = "app_voice_call_playback_error", error = %err),
                None,
            )
            .context("VOICE_CALL_AUDIO_PLAYBACK_FAILED: build_output_stream")?;

        stream
            .play()
            .context("VOICE_CALL_AUDIO_PLAYBACK_FAILED: play")?;

        *self.playback_stream.lock().await = Some(stream);
        self.encoded_in.lock().await.clear();
        info!(action = "app_voice_call_playback_started");
        Ok(())
    }

    pub async fn stop_capture(&self) -> anyhow::Result<()> {
        if self.capture_stream.lock().await.take().is_some() {
            info!(action = "app_voice_call_capture_stopped");
        }
        Ok(())
    }

    pub async fn stop_playback(&self) -> anyhow::Result<()> {
        if self.playback_stream.lock().await.take().is_some() {
            info!(action = "app_voice_call_playback_stopped");
        }
        Ok(())
    }

    pub async fn take_encoded_packets(&self) -> Vec<Vec<u8>> {
        std::mem::take(&mut *self.encoded_out.lock().await)
    }

    pub async fn push_encoded_packet(&self, packet: Vec<u8>) {
        self.encoded_in.lock().await.push(packet);
    }

    pub fn set_mute(&self, muted: bool) {
        self.muted.store(muted, Ordering::Relaxed);
    }

    pub fn set_noise_suppression(&self, enabled: bool) {
        self.noise_suppression.store(enabled, Ordering::Relaxed);
    }

    // ── Conference multi-participant methods ─────────────────

    pub fn enable_conference_mode(&self) {
        self.conference_mode.store(true, Ordering::Relaxed);
        info!(action = "app_voice_call_conference_mode_enabled");
    }

    pub fn disable_conference_mode(&self) {
        self.conference_mode.store(false, Ordering::Relaxed);
        if let Ok(mut decoders) = self.participant_decoders.lock() {
            decoders.clear();
        }
        if let Ok(mut buffers) = self.participant_buffers.lock() {
            buffers.clear();
        }
        info!(action = "app_voice_call_conference_mode_disabled");
    }

    pub fn register_participant(&self, participant_id: &str) -> anyhow::Result<()> {
        let decoder = OpusDecoder::new(SampleRate::Hz48000, Channels::Mono)
            .context("VOICE_CALL_AUDIO_DECODE_FAILED")?;
        self.participant_decoders
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock poisoned: {}", e))?
            .insert(participant_id.to_string(), decoder);
        self.participant_buffers
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock poisoned: {}", e))?
            .insert(participant_id.to_string(), Vec::new());
        info!(action = "app_voice_call_participant_registered", participant_id = %participant_id);
        Ok(())
    }

    pub fn push_participant_packet(&self, participant_id: &str, packet: Vec<u8>) {
        if let Ok(mut buffers) = self.participant_buffers.lock() {
            if let Some(buf) = buffers.get_mut(participant_id) {
                buf.push(packet);
            }
        }
    }

    pub fn unregister_participant(&self, participant_id: &str) {
        if let Ok(mut decoders) = self.participant_decoders.lock() {
            decoders.remove(participant_id);
        }
        if let Ok(mut buffers) = self.participant_buffers.lock() {
            buffers.remove(participant_id);
        }
        info!(action = "app_voice_call_participant_unregistered", participant_id = %participant_id);
    }
}

/// Process captured f32 PCM through Opus encoder.
/// Accumulates partial frames across callbacks so no samples are discarded.
fn process_capture(
    data: &[f32],
    muted: &AtomicBool,
    noise_suppression: &AtomicBool,
    encoder: &TokioMutex<OpusEncoder>,
    output: &TokioMutex<Vec<Vec<u8>>>,
    leftover: &std::sync::Mutex<Vec<f32>>,
) {
    let is_muted = muted.load(Ordering::Relaxed);
    let is_ns = noise_suppression.load(Ordering::Relaxed);

    let raw: Vec<f32> = if is_muted {
        vec![0.0f32; data.len()]
    } else if is_ns {
        apply_noise_gate(data)
    } else {
        data.to_vec()
    };

    // Combine partial samples from previous callback
    let mut buf = match leftover.lock() {
        Ok(b) => b,
        Err(_) => return,
    };
    buf.extend_from_slice(&raw);
    let samples = std::mem::take(&mut *buf);
    drop(buf);

    let mut enc = encoder.blocking_lock();
    let mut out = output.blocking_lock();

    let mut pos = 0;
    while pos + FRAME_SIZE <= samples.len() {
        let chunk = &samples[pos..pos + FRAME_SIZE];
        let mut packet = vec![0u8; MAX_PACKET];
        match enc.encode_float(chunk, FRAME_SIZE as i32, &mut packet, MAX_PACKET as i32) {
            Ok(len) => {
                packet.truncate(len as usize);
                out.push(packet);
            }
            Err(e) => {
                warn!(action = "app_voice_call_encode_failed", error = %e);
            }
        }
        pos += FRAME_SIZE;
    }

    // Save leftover for next callback
    if pos < samples.len() {
        if let Ok(mut leftover_guard) = leftover.lock() {
            *leftover_guard = samples[pos..].to_vec();
        }
    }
}

/// Decode Opus packets into f32 PCM for playback.
/// In conference mode, mixes audio from all registered participants.
fn process_playback(
    data: &mut [f32],
    decoder: &TokioMutex<OpusDecoder>,
    encoded_in: &TokioMutex<Vec<Vec<u8>>>,
    conference_mode: &AtomicBool,
    participant_decoders: &std::sync::Mutex<HashMap<String, OpusDecoder>>,
    participant_buffers: &std::sync::Mutex<HashMap<String, Vec<Vec<u8>>>>,
) {
    if conference_mode.load(Ordering::Relaxed) {
        process_playback_multi(data, participant_decoders, participant_buffers);
    } else {
        process_playback_single(data, decoder, encoded_in);
    }
}

fn process_playback_single(
    data: &mut [f32],
    decoder: &TokioMutex<OpusDecoder>,
    encoded_in: &TokioMutex<Vec<Vec<u8>>>,
) {
    let samples = data.len();
    let mut offset = 0;
    let mut dec = decoder.blocking_lock();
    let mut buf = encoded_in.blocking_lock();

    while offset + FRAME_SIZE <= samples {
        if let Some(packet) = buf.pop() {
            match dec.decode_float(
                Some(&packet),
                &mut data[offset..offset + FRAME_SIZE],
                FRAME_SIZE as i32,
                false,
            ) {
                Ok(_) => {}
                Err(e) => {
                    warn!(action = "app_voice_call_decode_failed", error = %e);
                    data[offset..offset + FRAME_SIZE].fill(0.0);
                }
            }
        } else {
            data[offset..offset + FRAME_SIZE].fill(0.0);
        }
        offset += FRAME_SIZE;
    }

    if offset < samples {
        data[offset..].fill(0.0);
    }
}

/// Conference multi-source mixer: decodes and sums PCM from all participants.
fn process_playback_multi(
    data: &mut [f32],
    participant_decoders: &std::sync::Mutex<HashMap<String, OpusDecoder>>,
    participant_buffers: &std::sync::Mutex<HashMap<String, Vec<Vec<u8>>>>,
) {
    let samples = data.len();
    data.fill(0.0); // start with silence

    if let Ok(mut decoders) = participant_decoders.lock() {
        if let Ok(mut buffers) = participant_buffers.lock() {
            let mut mixed = vec![0.0f32; samples];

            for (pid, buf) in buffers.iter_mut() {
                if let Some(dec) = decoders.get_mut(pid) {
                    let mut offset = 0;
                    while offset + FRAME_SIZE <= samples {
                        if let Some(packet) = buf.pop() {
                            let mut frame = vec![0.0f32; FRAME_SIZE];
                            if dec
                                .decode_float(Some(&packet), &mut frame, FRAME_SIZE as i32, false)
                                .is_ok()
                            {
                                for (i, sample) in frame.iter().enumerate() {
                                    mixed[offset + i] += sample;
                                }
                            }
                        }
                        offset += FRAME_SIZE;
                    }
                } else {
                    // Decoder missing — drain buffer
                    buf.clear();
                }
            }

            // Copy mixed output, soft-clip to prevent distortion
            for (i, sample) in mixed.iter().enumerate() {
                data[i] = sample.tanh();
            }
        }
    }
}

fn apply_noise_gate(samples: &[f32]) -> Vec<f32> {
    let threshold: f32 = 0.01;
    let hold_samples: usize = 480;
    let mut held = 0usize;
    samples
        .iter()
        .map(|&s| {
            if s.abs() > threshold {
                held = hold_samples;
                s
            } else if held > 0 {
                held -= 1;
                s
            } else {
                0.0
            }
        })
        .collect()
}
