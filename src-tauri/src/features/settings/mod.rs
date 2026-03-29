//! 模块入口：settings。
//!
//! 说明：该文件负责导出子模块与组织依赖关系。
//!
//! 约定：注释中文，日志英文（tracing）。
pub mod data;
pub mod di;
pub mod domain;
#[cfg(debug_assertions)]
pub mod mock;
pub mod usecases;

use anyhow::anyhow;
use serde_json::Value;
use std::any::TypeId;

use crate::features::settings::data::config_store_port_adapter::ConfigStorePortAdapter;
use crate::features::settings::usecases::config_usecases;

pub use di::commands::*;

pub trait ConfigValueExtractor<T> {
    fn extract(value: &Value) -> T;
    fn into_json(self) -> Value;
}

impl ConfigValueExtractor<u32> for u32 {
    fn extract(value: &Value) -> u32 {
        value.as_u64().unwrap_or(0) as u32
    }

    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<u64> for u64 {
    fn extract(value: &Value) -> u64 {
        value.as_u64().unwrap_or(0)
    }

    fn into_json(self) -> Value {
        Value::Number(serde_json::Number::from(self))
    }
}

impl ConfigValueExtractor<String> for String {
    fn extract(value: &Value) -> String {
        value.as_str().unwrap_or("").to_string()
    }

    fn into_json(self) -> Value {
        Value::String(self)
    }
}

impl ConfigValueExtractor<bool> for bool {
    fn extract(value: &Value) -> bool {
        value.as_bool().unwrap_or(false)
    }

    fn into_json(self) -> Value {
        Value::Bool(self)
    }
}

pub async fn get_config_value<T>(key: String) -> T
where
    T: ConfigValueExtractor<T> + Send + 'static,
{
    let adapter = ConfigStorePortAdapter::shared();
    if TypeId::of::<T>() == TypeId::of::<bool>() {
        return T::extract(&Value::Bool(
            config_usecases::get_config_bool(key, adapter)
                .await
                .unwrap_or(false),
        ));
    }
    if TypeId::of::<T>() == TypeId::of::<u32>() {
        return T::extract(&Value::Number(serde_json::Number::from(
            config_usecases::get_config_u32(key, adapter)
                .await
                .unwrap_or(0),
        )));
    }
    if TypeId::of::<T>() == TypeId::of::<u64>() {
        return T::extract(&Value::Number(serde_json::Number::from(
            config_usecases::get_config_u64(key, adapter)
                .await
                .unwrap_or(0),
        )));
    }

    T::extract(&Value::String(
        config_usecases::get_config_string(key, adapter)
            .await
            .unwrap_or_default(),
    ))
}

pub async fn get_server_config_value<T>(server_socket: String) -> T
where
    T: ConfigValueExtractor<T> + Send + 'static,
{
    let adapter = ConfigStorePortAdapter::shared();
    if TypeId::of::<T>() == TypeId::of::<bool>() {
        return T::extract(&Value::Bool(
            config_usecases::get_server_config_bool(server_socket, adapter)
                .await
                .unwrap_or(false),
        ));
    }
    if TypeId::of::<T>() == TypeId::of::<u32>() {
        return T::extract(&Value::Number(serde_json::Number::from(
            config_usecases::get_server_config_u32(server_socket, adapter)
                .await
                .unwrap_or(0),
        )));
    }
    if TypeId::of::<T>() == TypeId::of::<u64>() {
        return T::extract(&Value::Number(serde_json::Number::from(
            config_usecases::get_server_config_u64(server_socket, adapter)
                .await
                .unwrap_or(0),
        )));
    }

    T::extract(&Value::String(
        config_usecases::get_server_config_string(server_socket, adapter)
            .await
            .unwrap_or_default(),
    ))
}

pub async fn update_config<T>(key: String, value: T) -> anyhow::Result<()>
where
    T: ConfigValueExtractor<T> + Send + 'static,
{
    let adapter = ConfigStorePortAdapter::shared();
    let json = value.into_json();
    if let Some(boolean) = json.as_bool() {
        return config_usecases::update_config_bool(key, boolean, adapter).await;
    }
    if let Some(number) = json.as_u64() {
        if TypeId::of::<T>() == TypeId::of::<u32>() {
            return config_usecases::update_config_u32(key, number as u32, adapter).await;
        }
        return config_usecases::update_config_u64(key, number, adapter).await;
    }
    if let Some(text) = json.as_str() {
        return config_usecases::update_config_string(key, text.to_string(), adapter).await;
    }
    Err(anyhow!("Unsupported config value type"))
}
