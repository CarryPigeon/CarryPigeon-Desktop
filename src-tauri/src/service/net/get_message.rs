use crate::config::get_config;
use crate::mapper::common_message::CommonNoticeMessage;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::Level;

#[derive(Serialize, Deserialize)]
pub struct GetHistoryMessageData {
    pub from_time: String,
    pub count: u32,
    pub channel_id: String,
}

#[derive(Serialize, Deserialize)]
pub struct GetMessageFromId {
    pub mids: Vec<u64>,
}

#[derive(Serialize, Deserialize)]
pub struct GetHistoryMessage<T> {
    pub id: u64,
    pub route: String,
    pub data: T,
}

impl GetHistoryMessage<GetHistoryMessageData> {
    pub async fn new(
        id: u64,
        route: String,
        from_time: String,
        count: u32,
        channel_name: String,
    ) -> Option<Self> {
        let config_result = get_config().await;
        let channel_id = match config_result {
            // 配置获取成功，继续处理
            Some(config) => {
                // 检查指定频道是否存在配置
                if config.get(format!("channel_{channel_name}")).is_none() {
                    tracing::event!(Level::ERROR, "channel_id not found");
                    // TODO: 调用前端函数提示出错
                    return None;
                }
                // 获取频道对应的socket地址并发送消息
                config.get("channel_id").unwrap().clone()
            }
            None => {
                // TODO: 调用前端函数提示出错
                tracing::event!(Level::ERROR, "Failed to read config file");
                return None;
            }
        };
        Some(GetHistoryMessage {
            id,
            route,
            data: GetHistoryMessageData {
                from_time,
                count,
                channel_id: channel_id.to_string(),
            },
        })
    }
    pub async fn get_history_message(self: Arc<Self>, channel_name: String) {
        let client = reqwest::Client::new();
        let config_result = get_config().await;
        match config_result {
            // 配置获取成功，继续处理
            Some(config) => {
                // 检查指定频道是否存在配置
                if config.get(format!("channel_{channel_name}")).is_none() {
                    tracing::event!(Level::ERROR, "{channel_name} channel not found");
                    // TODO: 调用前端函数提示出错
                    return;
                }
                // 获取频道对应的socket地址并发送消息
                let socket = config
                    .get(format!("channel_{channel_name}"))
                    .unwrap()
                    .as_str()
                    .unwrap();
                let v = serde_json::to_value(self).unwrap();
                let result = client.post(socket).json(&v).send().await;
                match result {
                    Ok(v) => {
                        // TODO： http返回值的处理
                    }
                    // HTTP请求失败处理
                    Err(e) => {
                        // TODO: 调用前端函数提示出错
                        tracing::event!(Level::ERROR, "{e}");
                    }
                }
            }
            // 配置获取失败处理
            None => {
                // TODO: 调用前端函数提示出错
                tracing::event!(Level::ERROR, "Failed to read config file");
            }
        }
    }
}

impl GetHistoryMessage<GetMessageFromId> {
    pub fn new(id: u64, route: String, mids: Vec<u64>) -> Self {
        GetHistoryMessage {
            id,
            route,
            data: GetMessageFromId { mids },
        }
    }
    pub async fn get_message_from_id(
        self: Arc<Self>,
        channel_name: String,
    ) -> Option<CommonNoticeMessage> {
        let client = reqwest::Client::new();
        let config_result = get_config().await;
        match config_result {
            // 配置获取成功，继续处理
            Some(config) => {
                // 检查指定频道是否存在配置
                if config.get(format!("channel_{channel_name}")).is_none() {
                    tracing::event!(Level::ERROR, "{channel_name} channel not found");
                    // TODO: 调用前端函数提示出错
                }
                // 获取频道对应的socket地址并发送消息
                let socket = config
                    .get(format!("channel_{channel_name}"))
                    .unwrap()
                    .as_str()
                    .unwrap();
                let v = serde_json::to_value(self).unwrap();
                let result = client.post(socket).json(&v).send().await;
                match result {
                    Ok(v) => v.json().await.ok(),
                    // HTTP请求失败处理
                    Err(e) => {
                        // TODO: 调用前端函数提示出错
                        tracing::event!(Level::ERROR, "{e}");
                        None
                    }
                }
            }
            None => {
                // TODO: 调用前端函数提示出错
                tracing::event!(Level::ERROR, "Failed to read config file");
                None
            }
        }
    }
}
