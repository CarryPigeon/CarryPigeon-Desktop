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
        let default_device = self.host.default_input_device();
        let default_id = default_device
            .as_ref()
            .and_then(|d| d.id().ok())
            .map(|id| id.to_string())
            .unwrap_or_default();

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

        // 当系统枚举返回空列表但存在默认设备时，将其作为兜底项加入。
        // 某些 Windows 系统上 WASAPI 枚举可能因兼容性问题返回空迭代器。
        if devices.is_empty() {
            if let Some(ref device) = default_device {
                if let Some(info) = device_info(device, &default_id) {
                    devices.push(info);
                }
            }
        }

        // 当枚举结果非空但没有任何设备被标记为默认时（常见于 WASAPI 下
        // default_input_device().id() 与 input_devices() 返回的 ID 格式不一致），
        // 将系统默认设备强制追加到列表中。
        let has_default = devices.iter().any(|d| d.is_default);
        if !has_default {
            if let Some(ref device) = default_device {
                if let Ok(id) = device.id() {
                    if let Ok(description) = device.description() {
                        devices.push(AudioDeviceInfo {
                            device_id: id.to_string(),
                            name: description.to_string(),
                            is_default: true,
                        });
                    }
                }
            }
        }

        Ok(devices)
    }

    pub fn enumerate_output_devices(&self) -> Result<Vec<AudioDeviceInfo>> {
        let mut devices = Vec::new();
        let default_device = self.host.default_output_device();
        let default_id = default_device
            .as_ref()
            .and_then(|d| d.id().ok())
            .map(|id| id.to_string())
            .unwrap_or_default();

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

        // 当系统枚举返回空列表但存在默认设备时，将其作为兜底项加入。
        if devices.is_empty() {
            if let Some(ref device) = default_device {
                if let Some(info) = device_info(device, &default_id) {
                    devices.push(info);
                }
            }
        }

        // 当枚举结果非空但没有任何设备被标记为默认时，将系统默认设备强制追加。
        let has_default = devices.iter().any(|d| d.is_default);
        if !has_default {
            if let Some(ref device) = default_device {
                if let Ok(id) = device.id() {
                    if let Ok(description) = device.description() {
                        devices.push(AudioDeviceInfo {
                            device_id: id.to_string(),
                            name: description.to_string(),
                            is_default: true,
                        });
                    }
                }
            }
        }

        Ok(devices)
    }

    pub fn default_input_device_id(&self) -> Result<String> {
        let id = default_device_id(self.host.default_input_device());
        if id.is_empty() {
            anyhow::bail!("VOICE_AUDIO_DEVICE_UNAVAILABLE: no default input device found");
        }
        Ok(id)
    }

    pub fn default_output_device_id(&self) -> Result<String> {
        let id = default_device_id(self.host.default_output_device());
        if id.is_empty() {
            anyhow::bail!("VOICE_AUDIO_DEVICE_UNAVAILABLE: no default output device found");
        }
        Ok(id)
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
