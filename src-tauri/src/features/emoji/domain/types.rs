use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiEntry {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub added_at: u64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiIndex {
    pub version: u32,
    pub items: Vec<EmojiEntry>,
}

impl Default for EmojiIndex {
    fn default() -> Self {
        Self { version: 1, items: vec![] }
    }
}
