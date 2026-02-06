//! Tauri 应用入口：lib。
//!
//! 约定：注释中文，日志英文（tracing）。
pub mod app;
pub mod features;
pub mod shared;

/// 运行 Tauri 应用。
///
/// # 返回值
/// - `Ok(())`：启动成功并进入事件循环。
/// - `Err(anyhow::Error)`：启动失败原因。
///
/// # 说明
/// 该函数是二进制入口（`main.rs`）调用的统一入口，便于测试与复用。
pub fn run() -> anyhow::Result<()> {
    app::run()
}
