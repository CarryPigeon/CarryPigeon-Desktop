use tauri::command;

#[command]
pub fn write_app_log(content: String) -> Result<(), String> {
    tracing::info!(action = "app_frontend_log", content = %content);
    Ok(())
}
