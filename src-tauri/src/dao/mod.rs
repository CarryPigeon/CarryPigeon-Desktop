pub mod channel;
pub mod message;

use std::sync::{Arc, OnceLock};
use sea_orm::{ConnectOptions, Database, DatabaseConnection};

use crate::config::get_config_value;

pub struct CPDatabase{
    pub connection: DatabaseConnection,
}

impl CPDatabase {
    pub async fn new(url: &str) -> Self {
        let mut options = ConnectOptions::new(url);
        options
            .max_connections(get_config_value::<u32>("database_pool_max_connections").await) //config
            .connect_timeout(std::time::Duration::from_secs(3))
            .idle_timeout(std::time::Duration::from_secs(10))
            .min_connections(get_config_value::<u32>("database_pool_min_connections").await) //config
            .max_lifetime(std::time::Duration::from_secs(3600));
        Self {
            connection: Database::connect(options).await.unwrap(),
        }
    }
}

pub static DATABASE_POOL: OnceLock<Arc<CPDatabase>> = OnceLock::new();

pub async fn connect(url: &str) {
    let _ = DATABASE_POOL.set(Arc::new(CPDatabase::new(url).await));
    //let a: Option<channels::Model> = channels::Entity::find_by_id(1_u32).one(&DATABASE_POOL.get().unwrap().connection).await.unwrap();
}
