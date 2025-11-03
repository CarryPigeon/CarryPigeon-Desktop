use sea_orm:: entity::prelude::*;

#[sea_orm::model]
#[derive(Debug, Clone, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "channel")]
pub struct Model{
    #[sea_orm(primary_key)]
    pub id: u32,
    pub name: String,
    pub server_socket: String,
    pub owner_id: i32,
    pub created_at: DateTime,
    pub admin_ids: String, //JSON
    pub member_ids: String, //JSON
}

impl ActiveModelBehavior for ActiveModel{}