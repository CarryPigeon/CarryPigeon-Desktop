use sea_orm::entity::prelude::*;

#[sea_orm::model]
#[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "message")]
pub struct Model{
    #[sea_orm(primary_key)]
    pub message_id: u64,
    pub channel_id: u32,
    pub user_id: u32,
    pub content: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}

impl ActiveModelBehavior for ActiveModel{}
