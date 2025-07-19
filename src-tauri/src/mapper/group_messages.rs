use sqlx::{types::JsonValue, FromRow};

#[derive(Clone, Debug, FromRow)]
pub struct PrivateMessages {
    pub from_id: u32,
    pub to_id: u32,
    pub message_id: u32,
    pub date: String,
    pub data: String,
    pub json: JsonValue,
    pub file_path: String,
}
