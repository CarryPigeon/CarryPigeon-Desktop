//! 模块入口：domain/ports。
//!
//! 说明：该目录定义 network 领域层对外抽象端口。
//!
//! 约定：注释中文，日志英文（tracing）。

pub mod api_request_port;
pub mod tcp_backend_factory_port;
pub mod tcp_backend_port;
pub mod tcp_event_sink;
