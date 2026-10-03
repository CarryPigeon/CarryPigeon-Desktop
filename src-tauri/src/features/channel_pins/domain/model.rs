//! channel_pins｜领域模型：本地置顶频道 JSON 结构。
//!
//! 约定：注释中文，日志英文（tracing）。

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// 置顶频道本地存储 schema 版本。
pub const CHANNEL_PINS_SCHEMA_VERSION: u32 = 1;

fn default_schema_version() -> u32 {
    CHANNEL_PINS_SCHEMA_VERSION
}

/// 置顶频道本地存储信封（版本 1）。
///
/// 文件为面向用户可编辑的 JSON，因此字段均提供默认值，
/// 缺失字段或旧版本文件不应导致解析整体失败。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelPinsStateV1 {
    /// schema 版本号。
    #[serde(default = "default_schema_version")]
    pub schema_version: u32,
    /// serverSocket -> 置顶频道 ID 列表（按置顶先后顺序，越靠前越先展示）。
    #[serde(default)]
    pub servers: BTreeMap<String, Vec<String>>,
}

impl Default for ChannelPinsStateV1 {
    fn default() -> Self {
        Self {
            schema_version: CHANNEL_PINS_SCHEMA_VERSION,
            servers: BTreeMap::new(),
        }
    }
}
