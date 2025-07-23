#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommonNoticeMessage {
    route: String,
    data: String, // json
}
