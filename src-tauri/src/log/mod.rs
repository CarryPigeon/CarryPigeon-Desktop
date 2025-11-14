use tracing::{info, error, warn};

#[tauri::command]
pub fn log_info(info: String){
    info!("{}", info);
}

#[tauri::command]
pub fn log_error(error: String){
    error!("{}", error);
}

#[tauri::command]
pub fn log_warning(warning: String){
    warn!("{}", warning);
}