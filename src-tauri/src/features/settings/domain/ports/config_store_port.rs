//! settings｜领域端口：config_store_port。

use std::future::Future;
use std::pin::Pin;

pub type ConfigStoreFuture<'a, T> = Pin<Box<dyn Future<Output = anyhow::Result<T>> + Send + 'a>>;

pub trait ConfigStorePort: Send + Sync {
    fn get_config<'a>(&'a self) -> ConfigStoreFuture<'a, String>;
    fn get_config_bool<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, bool>;
    fn get_config_u32<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u32>;
    fn get_config_u64<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, u64>;
    fn get_config_string<'a>(&'a self, key: String) -> ConfigStoreFuture<'a, String>;
    fn get_server_config_string<'a>(
        &'a self,
        server_socket: String,
    ) -> ConfigStoreFuture<'a, String>;
    fn get_server_config_u32<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u32>;
    fn get_server_config_u64<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, u64>;
    fn get_server_config_bool<'a>(&'a self, server_socket: String) -> ConfigStoreFuture<'a, bool>;
    fn update_config_bool<'a>(&'a self, key: String, value: bool) -> ConfigStoreFuture<'a, ()>;
    fn update_config_u32<'a>(&'a self, key: String, value: u32) -> ConfigStoreFuture<'a, ()>;
    fn update_config_u64<'a>(&'a self, key: String, value: u64) -> ConfigStoreFuture<'a, ()>;
    fn update_config_string<'a>(&'a self, key: String, value: String) -> ConfigStoreFuture<'a, ()>;
}
