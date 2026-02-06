//! Tauri 应用入口：main。
//!
//! 约定：注释中文，日志英文（tracing）。
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tracing_subscriber::{
    Registry, filter::EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    let formatting_layer = fmt::layer().pretty().with_writer(std::io::stderr);

    Registry::default()
        .with(env_filter)
        .with(formatting_layer)
        .init();

    tracing::info!(action = "app_started", "CarryPigeon Desktop started");
    carrypigeon_desktop_lib::run()
}
