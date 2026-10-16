//! channel_pins｜本地频道置顶模块。
//!
//! 说明：服务端未提供置顶频道 API，置顶信息仅保存在本机 JSON 文件中；
//! 编辑入口为应用内置顶频道编辑器（写入整份有序列表），外部改动仍由后台轮询热加载。
//!
//! 约定：注释中文，日志英文（tracing）。

pub mod data;
pub mod di;
pub mod domain;
