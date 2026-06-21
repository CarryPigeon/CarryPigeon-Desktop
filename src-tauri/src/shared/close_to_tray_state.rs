//! 关闭到托盘行为缓存状态。
//!
//! 由 app setup 从 config.json 同步初始化，
//! settings 命令在更新 close_to_tray 后同步写入，
//! on_window_event 在 CloseRequested 时读取。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::sync::atomic::AtomicBool;

/// 关闭到托盘行为缓存状态。
pub struct CloseToTrayState(pub AtomicBool);
