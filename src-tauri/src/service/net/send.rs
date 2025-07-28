use crate::mapper::common_message::CommonNoticeMessage;
use crate::mapper::group_message::GroupMessage;
use crate::mapper::private_message::PrivateMessage;

pub struct SendService<T> {
    content: T,
}

impl SendService<PrivateMessage> {
    pub async fn send_message(&self) -> anyhow::Result<()> {
        // TODO: 完善发送逻辑
        Ok(())
    }
}

impl SendService<GroupMessage> {
    pub async fn send_message(&self) -> anyhow::Result<()> {
        // TODO: 完善发送逻辑
        Ok(())
    }
}

impl SendService<CommonNoticeMessage> {}
