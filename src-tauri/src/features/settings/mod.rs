//! 模块入口：settings。
//!
//! 说明：该文件负责导出子模块与组织依赖关系。
//!
//! 约定：注释中文，日志英文（tracing）。
pub mod data;
pub mod di;
pub mod domain;
pub mod mock;
pub mod usecases;

pub use di::commands::*;
pub use usecases::config_values::{get_config_value, get_server_config_value, update_config};
