use sea_orm::{ActiveValue::Set, QueryOrder, entity::prelude::*};
use serde::{Deserialize, Serialize};

use crate::dao::DATABASE_POOL;

#[sea_orm::model]
#[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "message")]
pub struct Model {
    pub server_socket: String,
    #[sea_orm(primary_key)]
    pub message_id: u64,
    pub channel_id: u32,
    pub user_id: u32,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
}

impl ActiveModelBehavior for ActiveModel {}

#[tauri::command]
pub async fn create_message(
    server_socket: String,
    message_id: u64,
    channel_id: u32,
    user_id: u32,
    content: String,
    created_at: i64,
    updated_at: i64,
) -> Result<(), String> {
    let temp = ActiveModel {
        server_socket: Set(server_socket),
        message_id: Set(message_id),
        channel_id: Set(channel_id),
        user_id: Set(user_id),
        content: Set(content),
        created_at: Set(created_at),
        updated_at: Set(updated_at),
    };
    temp.insert(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn update_message(
    server_socket: String,
    channel_id: u32,
    message_id: u64,
    user_id: u32,
    content: String,
    created_at: i64,
    updated_at: i64,
) -> Result<(), String> {
    let temp = ActiveModel {
        server_socket: Set(server_socket),
        message_id: Set(message_id),
        channel_id: Set(channel_id),
        user_id: Set(user_id),
        content: Set(content),
        created_at: Set(created_at),
        updated_at: Set(updated_at),
    };
    temp.update(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_message(message_id: u64) -> Result<(), String> {
    let temp = ActiveModel {
        message_id: Set(message_id),
        ..Default::default()
    };
    temp.delete(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_message_by_message_id(
    server_socket: String,
    channel_id: u32,
    message_id: u64,
) -> Result<Option<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::ChannelId.eq(channel_id))
        .filter(Column::MessageId.eq(message_id))
        .one(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages_by_channel_id(
    server_socket: String,
    channel_id: u32,
    from_id: u64,
    to_id: u64,
) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::ChannelId.eq(channel_id))
        .filter(Column::MessageId.gt(from_id))
        .filter(Column::MessageId.lt(to_id))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages_by_keyword(
    server_socket: String,
    channel_id: u32,
    keyword: String,
) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::ChannelId.eq(channel_id))
        .filter(Column::Content.contains(keyword))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages_by_user_id(
    server_socket: String,
    user_id: u32,
    from_id: u64,
    to_id: u64,
) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::UserId.eq(user_id))
        .filter(Column::MessageId.gt(from_id))
        .filter(Column::MessageId.lt(to_id))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_messages_by_time_range(
    server_socket: String,
    channel_id: u32,
    from_time: DateTimeUtc,
    to_time: DateTimeUtc,
) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::ChannelId.eq(channel_id))
        .filter(Column::CreatedAt.gt(from_time.timestamp()))
        .filter(Column::CreatedAt.lt(to_time.timestamp()))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_latest_local_message_date(
    server_socket: String,
    channel_id: u32,
) -> Result<Option<i64>, String> {
    let result = Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::ChannelId.eq(channel_id))
        .order_by_desc(Column::CreatedAt)
        .one(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.map(|m| m.created_at))
}
