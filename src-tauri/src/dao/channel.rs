use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use crate::dao::DATABASE_POOL;

#[sea_orm::model]
#[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "channel")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: u32,
    pub name: String,
    pub server_socket: String,
    pub owner_id: i32,
    pub created_at: i64,
    pub admin_ids: String,  //JSON
    pub member_ids: String, //JSON
}

impl ActiveModelBehavior for ActiveModel {}

#[tauri::command]
pub async fn get_all_channels() -> Result<Vec<Model>, String> {
    Entity::find()
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_all_channels_by_server_socket(server_socket: String) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_channel_by_id(server_socket: String, channel_id: u32) -> Result<Option<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::Id.eq(channel_id))
        .one(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_channel_by_name(server_socket: String, name: String) -> Result<Option<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::Name.eq(name))
        .one(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_channel_by_owner_id(server_socket: String, owner_id: u32) -> Result<Option<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::OwnerId.eq(owner_id))
        .one(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_channel_by_admin_ids(server_socket: String, admin_ids: String) -> Result<Vec<Model>, String> {
    Entity::find()
        .filter(Column::ServerSocket.eq(server_socket))
        .filter(Column::AdminIds.eq(admin_ids))
        .all(&DATABASE_POOL.get().unwrap().connection)
        .await
        .map_err(|e| e.to_string())
}
