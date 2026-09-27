//! ai｜客户端可替换 AI provider：密钥保管 + OpenAI 兼容调用。
//!
//! 说明：
//! - 密钥只保存在系统 keyring（`shared::secure_store`），不落库、不进日志；
//! - 上游调用统一走 OpenAI 兼容协议（`/chat/completions`、`/models`），
//!   便于前端替换任意兼容服务（OpenAI / DeepSeek / Ollama / 自建网关）。

pub mod data;
pub mod di;
pub mod domain;
pub mod usecases;
