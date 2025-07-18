use sqlx::FromRow;

#[derive(Clone, Debug, FromRow)]
struct Friend {
    id: u32,
    name: String,
}
