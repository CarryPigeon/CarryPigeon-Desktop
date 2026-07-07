use crate::shared::app_data_dir::get_app_data_dir;
use crate::shared::error::CommandResult;
use std::fs::File;
use std::io::{BufRead, BufReader};
use tauri::command;

#[command]
pub fn write_app_log(content: String) -> CommandResult<()> {
    tracing::info!(action = "app_frontend_log", content = %content);
    Ok(())
}

/// 读取应用日志文件的最后若干行。
///
/// @param limit - 最多返回的行数（正整数）。
/// @returns 按时间顺序排列的日志行列表；文件不存在时返回空列表。
#[command]
pub fn read_app_log_lines(limit: u32) -> CommandResult<Vec<String>> {
    let log_path = match get_app_data_dir() {
        Ok(dir) => dir.join("logs").join("app.log"),
        Err(e) => {
            tracing::error!(action = "app_log_read_failed", reason = "app_data_dir_unavailable", error = %e);
            return Err(format!("[APP_DATA_DIR_UNAVAILABLE] {e}"));
        }
    };

    if !log_path.exists() {
        return Ok(Vec::new());
    }

    let file = match File::open(&log_path) {
        Ok(f) => f,
        Err(e) => {
            tracing::error!(action = "app_log_read_failed", path = ?log_path, error = %e);
            return Err(format!("[LOG_OPEN_FAILED] {e}"));
        }
    };

    let reader = BufReader::new(file);
    let mut lines: Vec<String> = Vec::new();
    let limit = limit.max(1) as usize;

    for line in reader.lines() {
        match line {
            Ok(text) => {
                lines.push(text);
                if lines.len() > limit {
                    lines.remove(0);
                }
            }
            Err(e) => {
                tracing::error!(action = "app_log_read_failed", error = %e);
                return Err(format!("[LOG_READ_FAILED] {e}"));
            }
        }
    }

    Ok(lines)
}
