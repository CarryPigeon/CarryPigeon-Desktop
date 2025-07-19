use sqlx::FromRow;

#[derive(Clone, Debug, FromRow)]
pub struct Friend {
    id: u32,
    name: String,
}
