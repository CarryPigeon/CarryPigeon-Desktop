//! plugin_store｜server socket → HTTP origin 映射。
//!
//! 说明：
//! - 该模块保留在 plugin_store 内，是为了减少改动面（上层通过 `super::origin::*` 引用）；
//! - 具体实现已下沉到 `crate::shared::net::origin`，避免多处重复实现。

pub(super) use crate::shared::net::origin::{port_suffix, to_http_origin};
