use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Clone, Debug, FromRow, Deserialize, Serialize)]
pub struct PrivateMessage {
    pub from_id: u32,
    pub to_id: u32,
    pub message_id: u32,
    pub date: String,
    pub data: String,
    pub json: String,
    pub file_path: String,
}

impl PrivateMessage {
    pub fn new(
        from_id: u32,
        to_id: u32,
        message_id: u32,
        date: String,
        data: String,
        json: String,
        file_path: String,
    ) -> Self {
        PrivateMessage {
            from_id,
            to_id,
            message_id,
            date,
            data,
            json,
            file_path,
        }
    }
    pub fn from_string(v: String) -> Self {
        serde_json::from_str(&v).unwrap()
    }
}
