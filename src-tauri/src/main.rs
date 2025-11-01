// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{
    filter::EnvFilter, fmt, layer::SubscriberExt, util::SubscriberInitExt, Registry,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 处理tracing输出和调用
    // 此处过滤了info以下的信息
    // 正式版时需要替换为warn
    let _ = Box::new(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")));
    // 输出到控制台中
    //let formatting_layer = Box::(fmt::layer().pretty().with_writer(std::io::stderr));
    let formatting_layer = Box::new(fmt::layer());

    // 输出到文件中
    //let file_appender = Box::new(rolling::never("logs", "log.txt"));
    //let (non_blocking_appender, _guard) = non_blocking(file_appender);
    let file_layer = Box::new(
        fmt::layer()
            .with_ansi(false)
            //.with_writer(non_blocking_appender),
    );

    // 注册
    Registry::default()
        //.with(env_filter)
        .with(formatting_layer)
        .with(file_layer)
        .init();

    tracing::info!("CarryPigeon Desktop Started");
/*
    let config_result = get_config().await;
    tracing::info!("{:?}", config_result);

    // TODO: 配置文件读取
     let mut tcp_service = TcpService::new("127.0.0.1:8080".to_string()).await;
    unsafe {
        TCP_SERVICE.get_mut().unwrap().receive_message().await?;
    } */

    carrypigeon_desktop_lib::run()
}
