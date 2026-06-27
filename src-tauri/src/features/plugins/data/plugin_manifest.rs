//! plugins｜数据层：plugin_manifest。
//!
//! 约定：注释中文，日志英文（tracing）。
use crate::features::plugins::domain::types::PluginManifest;
use anyhow::Context;
use serde::{Deserialize, Serialize};

/// 插件清单文件路径（历史约定）。
const PLUGIN_CONFIG: &str = "./plugins.json";

/// 插件清单列表（存储结构）。
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifestList {
    /// 插件条目列表。
    pub plugins: Vec<PluginManifest>,
}

impl PluginManifestList {
    /// 读取（或初始化）插件清单列表。
    ///
    /// # 返回值
    /// - `Ok(Self)`：读取成功；若文件不存在则返回空列表。
    /// - `Err(anyhow::Error)`：读取失败原因。
    pub async fn new() -> anyhow::Result<Self> {
        match tokio::fs::read_to_string(PLUGIN_CONFIG).await {
            Ok(list) => {
                let trimmed = list.trim();
                if trimmed.is_empty() {
                    return Ok(Self { plugins: vec![] });
                }
                Self::from_json_str(trimmed)
            }
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(Self { plugins: vec![] }),
            Err(err) => Err(err.into()),
        }
    }

    /// 从 JSON 字符串解析清单列表。
    ///
    /// # 参数
    /// - `json_str`：清单 JSON 字符串。
    ///
    /// # 返回值
    /// - `Ok(Self)`：解析成功。
    /// - `Err(anyhow::Error)`：解析失败原因。
    pub fn from_json_str(json_str: &str) -> anyhow::Result<Self> {
        let manifest_list: PluginManifestList =
            serde_json::from_str(json_str).context("Failed to parse plugin manifest list JSON")?;
        Ok(manifest_list)
    }

    /// 将清单列表序列化为 pretty JSON 字符串。
    ///
    /// # 返回值
    /// - `Ok(String)`：JSON 字符串。
    /// - `Err(anyhow::Error)`：序列化失败原因。
    pub fn to_json_string(&self) -> anyhow::Result<String> {
        let json_str = serde_json::to_string_pretty(self)
            .context("Failed to serialize plugin manifest list to JSON")?;
        Ok(json_str)
    }

    /// 将清单列表写回磁盘文件。
    ///
    /// # 返回值
    /// - `Ok(())`：写入成功。
    /// - `Err(anyhow::Error)`：写入失败原因。
    pub async fn save(&self) -> anyhow::Result<()> {
        let json_str = self.to_json_string()?;
        tokio::fs::write(PLUGIN_CONFIG, json_str).await?;
        Ok(())
    }

    /// 添加或覆盖一个插件清单条目（按 name 去重）。
    ///
    /// # 参数
    /// - `plugin`：要写入的插件清单。
    ///
    /// # 返回值
    /// - `Ok(())`：写入成功。
    /// - `Err(anyhow::Error)`：写入失败原因。
    pub async fn add_plugin(&mut self, plugin: PluginManifest) -> anyhow::Result<()> {
        if let Some(existing) = self.plugins.iter_mut().find(|p| p.name == plugin.name) {
            *existing = plugin;
        } else {
            self.plugins.push(plugin);
        }
        self.save().await?;
        Ok(())
    }

    /// 更新一个已存在的插件清单条目（按 name 匹配）。
    ///
    /// # 参数
    /// - `plugin`：新的插件清单内容。
    ///
    /// # 返回值
    /// - `Ok(())`：更新成功或未找到目标（未找到时视为 no-op）。
    /// - `Err(anyhow::Error)`：写入失败原因。
    pub async fn update_plugin(&mut self, plugin: PluginManifest) -> anyhow::Result<()> {
        if let Some(existing) = self.plugins.iter_mut().find(|p| p.name == plugin.name) {
            *existing = plugin;
            self.save().await?;
        }
        Ok(())
    }

    /// 从磁盘重新读取清单列表（忽略当前内存中的 plugins）。
    ///
    /// # 返回值
    /// - `Ok(Self)`：读取成功。
    /// - `Err(anyhow::Error)`：读取失败原因。
    pub async fn load_from_file(&self) -> anyhow::Result<Self> {
        let list = tokio::fs::read_to_string(PLUGIN_CONFIG).await?;
        Self::from_json_str(&list)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::plugins::domain::types::PluginManifest;

    fn sample_manifest() -> PluginManifest {
        PluginManifest {
            name: "test-plugin".to_string(),
            version: "1.0.0".to_string(),
            description: Some("A test plugin".to_string()),
            author: Some("tester".to_string()),
            license: Some("MIT".to_string()),
            url: "https://example.com/plugin".to_string(),
            frontend_sha256: "a".repeat(64),
            backend_sha256: "b".repeat(64),
        }
    }

    #[test]
    fn round_trip_empty_list() {
        let list = PluginManifestList { plugins: vec![] };
        let json = list.to_json_string().unwrap();
        let parsed = PluginManifestList::from_json_str(&json).unwrap();
        assert_eq!(parsed.plugins.len(), 0);
    }

    #[test]
    fn round_trip_single_plugin() {
        let mut list = PluginManifestList { plugins: vec![] };
        list.plugins.push(sample_manifest());
        let json = list.to_json_string().unwrap();
        let parsed = PluginManifestList::from_json_str(&json).unwrap();
        assert_eq!(parsed.plugins.len(), 1);
        assert_eq!(parsed.plugins[0].name, "test-plugin");
        assert_eq!(parsed.plugins[0].version, "1.0.0");
    }

    #[test]
    fn from_json_invalid() {
        let err = PluginManifestList::from_json_str("{invalid json}").unwrap_err();
        assert!(
            err.to_string()
                .contains("Failed to parse plugin manifest list JSON")
        );
    }

    #[test]
    fn from_json_empty_string() {
        let err = PluginManifestList::from_json_str("").unwrap_err();
        assert!(
            err.to_string()
                .contains("Failed to parse plugin manifest list JSON")
        );
    }
}
