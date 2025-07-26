use crate::mapper::common_message::{CommonNoticeMessage, CommonNoticeMessageRoute};
use std::rc::Rc;

pub fn notification(message: Rc<CommonNoticeMessage>) -> anyhow::Result<()> {
    // TODO: 完善通知逻辑
    if message.route == CommonNoticeMessageRoute::CorePrivateMessage.to_string() {
        //println!("Private Message: {}", message.data);
    } else if message.route == CommonNoticeMessageRoute::CoreGroupMessage.to_string() {
        //println!("Group Message: {}", message.data);
    } else {
        return Err(anyhow::anyhow!("Unknown Route"));
    }
    Ok(())
}
