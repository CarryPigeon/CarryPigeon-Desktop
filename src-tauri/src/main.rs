//! Tauri 应用入口：main。
//!
//! 约定：注释中文，日志英文（tracing）。
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 注意：全局 tracing subscriber 由 `app::run()` 的 setup 阶段统一初始化
    // （stderr 层 + 文件层）。此处不能提前 `init()`，否则文件日志层
    // `try_init()` 会因 subscriber 已存在而失败，导致 release 包日志文件恒为空。
    carrypigeon_desktop_lib::run()
}
