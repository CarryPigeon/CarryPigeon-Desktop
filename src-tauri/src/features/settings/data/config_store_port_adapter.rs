//! settings｜数据适配器：config_store_port_adapter。

use crate::features::settings::domain::ports::config_store_port::{
    ConfigStoreFuture, ConfigStorePort,
};

use super::config_store;

#[derive(Debug, Default, Clone, Copy)]
pub struct ConfigStorePortAdapter;

impl ConfigStorePortAdapter {
    pub fn shared() -> &'static Self {
        static ADAPTER: ConfigStorePortAdapter = ConfigStorePortAdapter;
        &ADAPTER
    }
}

impl ConfigStorePort for ConfigStorePortAdapter {
    fn get_config<'a>(&'a self) -> ConfigStoreFuture<'a, String> {
        Box::pin(async { Ok(config_store::get_config().await) })
    }

    fn get_config_bool<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, bool> {
        Box::pin(async move { Ok(config_store::get_config_bool(key).await) })
    }

    fn get_config_u32<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u32> {
        Box::pin(async move { Ok(config_store::get_config_u32(key).await) })
    }

    fn get_config_u64<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u64> {
        Box::pin(async move { Ok(config_store::get_config_u64(key).await) })
    }

    fn get_config_string<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, String> {
        Box::pin(async move { Ok(config_store::get_config_string(key).await) })
    }

    fn get_server_config_string<'a>(
        &'a self,
        server_socket: String,
    ) -> ConfigStoreFuture<'a, String> {
        Box::pin(async move { Ok(config_store::get_server_config_string(server_socket).await) })
    }

    fn get_server_config_u32<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u32> {
        Box::pin(async move { Ok(config_store::get_server_config_u32(server_socket).await) })
    }

    fn get_server_config_u64<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u64> {
        Box::pin(async move { Ok(config_store::get_server_config_u64(server_socket).await) })
    }

    fn get_server_config_bool<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, bool> {
        Box::pin(async move { Ok(config_store::get_server_config_bool(server_socket).await) })
    }

    fn update_config_bool<'a>(&'a self, key: String, value: bool) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_bool(key, value).await })
    }

    fn update_config_u32<'a>(&'a self, key: String, value: u32) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_u32(key, value).await })
    }

    fn update_config_u64<'a>(&'a self, key: String, value: u64) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_u64(key, value).await })
    }

    fn update_config_string<'a>(&'a self, key: String, value: String) -> ConfigStoreFuture<'a, ()> {
        Box::pin(async move { config_store::update_config_string(key, value).await })
    }
}
