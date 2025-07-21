pub mod friends;
pub mod group_message;
pub mod groups;
mod message_object;
pub mod private_message;

use sqlx::{Pool, Sqlite, SqlitePool};
use tokio::sync::OnceCell;
use tracing::instrument;

pub static SQLITE_POOL: OnceCell<SqlitePool> = OnceCell::const_new();

#[instrument]
pub async fn init_pool() {
    let url = ""; // TODO: 后续获取
    match Pool::<Sqlite>::connect(format!("sqlite::memory:{url}").as_str()).await {
        Ok(v) => match SQLITE_POOL.set(v) {
            Ok(_) => {}
            Err(e) => {
                tracing::error!("Failed to set SQLite POOL: {}", e);
            }
        },
        Err(e) => {
            tracing::error!("Failed to connect to SQLite POOL: {}", e);
        }
    }
}
