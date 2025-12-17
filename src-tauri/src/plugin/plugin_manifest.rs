use anyhow::Context;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub name: String,
    pub version: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub license: Option<String>,
    pub url: String,
    pub frontend_sha256: String,
    pub backend_sha256: String,
}

const PLUGIN_CONFIG: &str = "./plugins.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifestList {
    pub plugins: Vec<PluginManifest>,
}

impl PluginManifestList {
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

    pub fn from_json_str(json_str: &str) -> anyhow::Result<Self> {
        let manifest_list: PluginManifestList =
            serde_json::from_str(json_str).context("Failed to parse plugin manifest list JSON")?;
        Ok(manifest_list)
    }

    pub fn to_json_string(&self) -> anyhow::Result<String> {
        let json_str = serde_json::to_string_pretty(self)
            .context("Failed to serialize plugin manifest list to JSON")?;
        Ok(json_str)
    }

    pub async fn save(&self) -> anyhow::Result<()> {
        let json_str = self.to_json_string()?;
        tokio::fs::write(PLUGIN_CONFIG, json_str).await?;
        Ok(())
    }

    pub async fn add_plugin(&mut self, plugin: PluginManifest) -> anyhow::Result<()> {
        if let Some(existing) = self.plugins.iter_mut().find(|p| p.name == plugin.name) {
            *existing = plugin;
        } else {
            self.plugins.push(plugin);
        }
        self.save().await?;
        Ok(())
    }

    pub async fn update_plugin(&mut self, plugin: PluginManifest) -> anyhow::Result<()> {
        if let Some(existing) = self.plugins.iter_mut().find(|p| p.name == plugin.name) {
            *existing = plugin;
            self.save().await?;
        }
        Ok(())
    }

    pub async fn load_from_file(&self) -> anyhow::Result<Self> {
        let list = tokio::fs::read_to_string(PLUGIN_CONFIG).await?;
        Self::from_json_str(&list)
    }
}
