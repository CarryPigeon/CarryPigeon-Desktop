//! 模块入口：windows。
//!
//! 说明：该文件负责导出子模块与组织依赖关系。
//!
//! 约定：注释中文，日志英文（tracing）。
pub mod data;
pub mod di;
pub mod domain;
#[cfg(debug_assertions)]
pub mod mock;
pub mod usecases;

pub use di::commands::*;
