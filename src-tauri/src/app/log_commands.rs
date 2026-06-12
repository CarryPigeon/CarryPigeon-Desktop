use crate::shared::error::CommandResult;
use tauri::command;

#[command]
pub fn write_app_log(content: String) -> CommandResult<()> {
    tracing::info!(action = "app_frontend_log", content = %content);
    Ok(())
}
