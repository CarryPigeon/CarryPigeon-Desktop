use std::sync::Arc;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::Level;
use crate::config::get_config;

#[derive(Serialize, Deserialize)]
pub struct DeleteData{
    pub mid: u64,
}

#[derive(Serialize, Deserialize)]
pub struct DeleteMessage{
    pub id: u64,
    pub route: String,
    pub data: DeleteData,
}

impl DeleteMessage{
    pub fn new(id: u64, mid: u64) -> Self{
       DeleteMessage{
            id,
            route: "/core/msg/delete".to_string(),
            data: DeleteData{
                mid,
            },
       }
    }
    pub fn new_task(self:Arc<Self>,id: u64, mid: u64, channel_name: String){
        let v = DeleteMessage::new(id, mid);
        let v = serde_json::to_value(v).unwrap();
        tokio::spawn(async move {self.delete_message(v, channel_name).await});
    }
    pub async fn delete_message(&self, v: Value, channel_name: String){
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
                let result = client.delete(socket).json(&v).send().await;
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