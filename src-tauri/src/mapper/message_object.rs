use sqlx::FromRow;

#[derive(Clone, Debug, FromRow)]
struct MessageObject {
    pub snow_id: u32,
    pub from_id: u32,
    pub to_id: u32,
    pub data: String,
    pub json: String,
    pub file_path: String,
}
