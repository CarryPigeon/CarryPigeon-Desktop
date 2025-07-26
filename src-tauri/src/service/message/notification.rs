use crate::dao::group_message;
use crate::dao::private_message;
use crate::mapper::common_message::{CommonNoticeMessage, CommonNoticeMessageRoute};
use crate::mapper::group_message::GroupMessage;
use crate::mapper::private_message::PrivateMessage;
use std::sync::Arc;

pub async fn notification(message: Arc<CommonNoticeMessage>) -> anyhow::Result<()> {
    // TODO: 完善通知逻辑
    if message.route == CommonNoticeMessageRoute::CorePrivateMessage.to_string() {
        //println!("Private Message: {}", message.data);
        let v: Box<PrivateMessage> = serde_json::from_str(&message.data)?;
        private_message::add_message(*v).await?;
        // TODO: 调用前端通知函数
    } else if message.route == CommonNoticeMessageRoute::CoreGroupMessage.to_string() {
        let v: Box<GroupMessage> = serde_json::from_str(&message.data)?;
        group_message::add_message(*v).await?;
        // TODO: 调用前端通知函数
    } else {
        return Err(anyhow::anyhow!("Unknown Route"));
    }
    Ok(())
}
