//! voice_message｜语音消息模块。
//!
//! 提供桌面端语音录制功能：
//! - 通过 cpal 采集麦克风 PCM 数据
//! - 保存为 WAV 文件
//! - 暴露 Tauri 命令供前端调用
//!
//! 约定：注释中文，日志英文（tracing）。

pub mod di;
pub mod recorder;
