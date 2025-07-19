use sqlx::{types::Json, FromRow};

#[derive(Clone, Debug, FromRow)]
pub struct Groups {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub owner_id: u32,
    pub admin_id: Json<Vec<u32>>,
    pub member_id: Json<Vec<u32>>,
}
