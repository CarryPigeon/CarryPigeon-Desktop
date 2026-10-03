//! channel_pins｜本地频道置顶模块。
//!
//! 说明：服务端未提供置顶频道 API，置顶信息仅保存在本机 JSON 文件中，
//! 并由后台轮询监听文件变化后向前端广播，实现修改后热加载。
//!
//! 约定：注释中文，日志英文（tracing）。

pub mod data;
pub mod di;
pub mod domain;
