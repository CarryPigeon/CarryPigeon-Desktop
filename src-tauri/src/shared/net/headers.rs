//! shared｜HTTP 请求头相关常量与构建方法。
//!
//! 约定：注释中文，日志英文（tracing）。

/// CarryPigeon API v1 的标准 `Accept` 头（Rust 侧请求 `/api/*` 时使用）。
pub(crate) const API_ACCEPT_V1: &str = "application/vnd.carrypigeon+json; version=1";
