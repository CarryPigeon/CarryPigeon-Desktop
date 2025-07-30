use crate::config::get_config;
use crate::model::send_message::{SendMessage, TextData};
use reqwest::get;
use serde_json::Value;
use std::sync::Arc;
use tracing::instrument;
use tracing::Level;

pub enum SendService<T> {
    Value(T),
}

impl SendService<TextData> {
    pub fn new_task(self: Arc<Self>, id: u64, to_id: u32, text: String) {
        let data = TextData { to_id, text };
        let v = SendMessage::<TextData>::new(id, to_id, data);
        let v = serde_json::to_value(v).unwrap();
        tokio::spawn(async move { self.send_message(v, "send".to_string()).await });
    }
}

impl<T> SendService<T> {
    /// 发送消息到指定频道的异步函数
    ///
    /// 该函数会根据频道名称获取对应的配置信息，然后通过HTTP POST请求将消息发送到指定的socket地址
    ///
    /// # 参数
    /// * `v` - 要发送的消息内容，类型为serde_json::Value
    /// * `channel_name` - 目标频道的名称，用于查找对应的socket配置
    ///
    /// # 返回值
    /// 无返回值
    pub async fn send_message(&self, v: Value, channel_name: String) {
        let client = reqwest::Client::new();
        let config_result = get_config().await;
        match config_result {
            // 配置获取成功，继续处理
            Ok(config) => {
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
            Err(e) => {
                // TODO: 调用前端函数提示出错
                tracing::event!(Level::ERROR, "{e}");
            }
        }
    }
}
