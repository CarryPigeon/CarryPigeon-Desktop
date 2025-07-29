// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use carrypigeon_desktop_lib::config::get_config;
use carrypigeon_desktop_lib::service::net::receive::ReceiveService;
use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{
    filter::EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt, Registry,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = get_config().await?;
    tracing::info!("{:?}", config);

    // 处理tracing输出和调用
    let env_filter =
    // 此处过滤了info以下的信息
    // 正式版时需要替换为warn
        Box::new(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    // 输出到控制台中
    //let formatting_layer = Box::(fmt::layer().pretty().with_writer(std::io::stderr));
    let formatting_layer = Box::new(fmt::layer());

    // 输出到文件中
    let file_appender = Box::new(rolling::never("logs", "log.txt"));
    let (non_blocking_appender, _guard) = non_blocking(file_appender);
    let file_layer = Box::new(
        fmt::layer()
            .with_ansi(false)
            .with_writer(non_blocking_appender),
    );

    // 注册
    Registry::default()
        .with(env_filter)
        .with(formatting_layer)
        .with(file_layer)
        .init();

    tracing::info!("CarryPigeon Desktop Started");

    let receive_service = ReceiveService::new();
    tokio::spawn(async move { receive_service.receive_loop().await });

    carrypigeon_desktop_lib::run()
}
