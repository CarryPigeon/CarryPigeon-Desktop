//! temp_file｜大文件临时文件管理模块。
//!
//! 本模块提供 `TempFileManager`，用于将大文件写入临时文件而非通过 IPC 返回 Vec<u8>。
//! 元数据通过 SQLite 持久化，支持启动时与显式命令清理。
//!
//! 约定：注释中文，日志英文（tracing）。

pub mod cleanup;
pub mod commands;
pub mod manager;
pub mod types;
pub use commands::*;
pub use manager::TempFileManager;
pub use types::*;

#[cfg(test)]
mod tests;
