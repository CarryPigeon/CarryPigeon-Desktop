use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device as CpalDevice, Stream, StreamConfig as CpalStreamConfig};
use tracing::warn;

use crate::features::voice_call::domain::model::AudioDeviceInfo;

fn device_info(device: &CpalDevice, default_id: &str) -> Option<AudioDeviceInfo> {
    let id = device.id().ok()?.to_string();
    let description = device.description().ok()?.to_string();
    Some(AudioDeviceInfo {
        device_id: id.clone(),
        name: description,
        is_default: id == default_id,
    })
}

fn default_device_id(device: Option<CpalDevice>) -> String {
    device
        .and_then(|d| d.id().ok())
        .map(|id| id.to_string())
        .unwrap_or_default()
}

pub struct AudioDeviceManager {
    host: cpal::Host,
}

impl AudioDeviceManager {
    pub fn new() -> Result<Self> {
        let host = cpal::default_host();
        Ok(Self { host })
    }

    pub fn enumerate_input_devices(&self) -> Result<Vec<AudioDeviceInfo>> {
        let mut devices = Vec::new();
        let default_id = default_device_id(self.host.default_input_device());

        match self.host.input_devices() {
            Ok(device_iter) => {
                for device in device_iter {
                    if let Some(info) = device_info(&device, &default_id) {
                        devices.push(info);
                    }
                }
            }
            Err(e) => {
                warn!(
                    action = "app_voice_call_enumerate_input_devices_failed",
                    error = %e,
                );
            }
        }
        Ok(devices)
    }

    pub fn enumerate_output_devices(&self) -> Result<Vec<AudioDeviceInfo>> {
        let mut devices = Vec::new();
        let default_id = default_device_id(self.host.default_output_device());

        match self.host.output_devices() {
            Ok(device_iter) => {
                for device in device_iter {
                    if let Some(info) = device_info(&device, &default_id) {
                        devices.push(info);
                    }
                }
            }
            Err(e) => {
                warn!(
                    action = "app_voice_call_enumerate_output_devices_failed",
                    error = %e,
                );
            }
        }
        Ok(devices)
    }

    pub fn default_input_config(&self) -> Result<CpalStreamConfig> {
        let device = self
            .host
            .default_input_device()
            .context("VOICE_AUDIO_DEVICE_UNAVAILABLE: no default input device found")?;
        let config = device
            .default_input_config()
            .context("VOICE_AUDIO_DEVICE_UNAVAILABLE")?;
        Ok(config.into())
    }

    pub fn default_output_config(&self) -> Result<CpalStreamConfig> {
        let device = self
            .host
            .default_output_device()
            .context("VOICE_AUDIO_DEVICE_UNAVAILABLE: no default output device found")?;
        let config = device
            .default_output_config()
            .context("VOICE_AUDIO_DEVICE_UNAVAILABLE")?;
        Ok(config.into())
    }
}

pub struct AudioStream {
    stream: Stream,
}

impl AudioStream {
    pub fn from_stream(stream: Stream) -> Self {
        Self { stream }
    }

    pub fn play(&self) -> Result<()> {
        self.stream.play().context("VOICE_AUDIO_STREAM_FAILED")
    }

    pub fn pause(&self) -> Result<()> {
        self.stream.pause().context("VOICE_AUDIO_STREAM_FAILED")
    }
}
