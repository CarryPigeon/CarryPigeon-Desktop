//! 托盘未读提示命令。

use std::{
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
        Mutex,
    },
    time::Duration,
};

use tauri::{AppHandle, Runtime, State, image::Image};

use crate::shared::error::{CommandResult, command_error, to_command_error};

const TRAY_ID: &str = "main";
const BLINK_INTERVAL_MS: u64 = 600;
const BLANK_ICON_SIZE: u32 = 32;

/// 托盘未读闪烁状态。
pub struct TrayUnreadState {
    has_unread: Arc<AtomicBool>,
    flashing: Arc<AtomicBool>,
    showing_blank: Arc<AtomicBool>,
    generation: Arc<AtomicU64>,
    lifecycle_lock: Mutex<()>,
    normal_icon: Image<'static>,
    blank_icon: Image<'static>,
}

impl TrayUnreadState {
    /// 创建托盘未读闪烁状态。
    pub fn new(normal_icon: Image<'static>) -> Self {
        Self {
            has_unread: Arc::new(AtomicBool::new(false)),
            flashing: Arc::new(AtomicBool::new(false)),
            showing_blank: Arc::new(AtomicBool::new(false)),
            generation: Arc::new(AtomicU64::new(0)),
            lifecycle_lock: Mutex::new(()),
            normal_icon: normal_icon.to_owned(),
            blank_icon: create_blank_icon(),
        }
    }
}

/// 设置托盘未读闪烁状态。
#[tauri::command]
pub fn set_tray_unread_flashing<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, TrayUnreadState>,
    has_unread: bool,
) -> CommandResult<()> {
    let _guard = state
        .lifecycle_lock
        .lock()
        .map_err(|err| command_error("TRAY_UNREAD_LOCK_FAILED", err.to_string()))?;

    state.has_unread.store(has_unread, Ordering::SeqCst);

    if has_unread {
        start_flashing(app, &state);
        return Ok(());
    }

    state.flashing.store(false, Ordering::SeqCst);
    state.showing_blank.store(false, Ordering::SeqCst);
    state.generation.fetch_add(1, Ordering::SeqCst);
    set_tray_icon(&app, &state.normal_icon)
}

/// 启动幂等托盘闪烁循环。
fn start_flashing<R: Runtime>(app: AppHandle<R>, state: &TrayUnreadState) {
    if state.flashing.swap(true, Ordering::SeqCst) {
        return;
    }

    let has_unread = Arc::clone(&state.has_unread);
    let flashing = Arc::clone(&state.flashing);
    let showing_blank = Arc::clone(&state.showing_blank);
    let generation = Arc::clone(&state.generation);
    let current_generation = generation.fetch_add(1, Ordering::SeqCst) + 1;
    let normal_icon = state.normal_icon.clone();
    let blank_icon = state.blank_icon.clone();

    std::thread::spawn(move || {
        loop {
            std::thread::sleep(Duration::from_millis(BLINK_INTERVAL_MS));

            if generation.load(Ordering::SeqCst) != current_generation {
                break;
            }

            if !has_unread.load(Ordering::SeqCst) || !flashing.load(Ordering::SeqCst) {
                showing_blank.store(false, Ordering::SeqCst);
                if let Err(err) = set_tray_icon(&app, &normal_icon) {
                    tracing::warn!(action = "app_tray_unread_restore_icon_failed", error = %err);
                }
                if generation.load(Ordering::SeqCst) == current_generation {
                    flashing.store(false, Ordering::SeqCst);
                }
                break;
            }

            let next_showing_blank = !showing_blank.load(Ordering::SeqCst);
            let icon = if next_showing_blank {
                &blank_icon
            } else {
                &normal_icon
            };

            if generation.load(Ordering::SeqCst) != current_generation {
                break;
            }

            if let Err(err) = set_tray_icon(&app, icon) {
                tracing::warn!(action = "app_tray_unread_set_icon_failed", error = %err);
                showing_blank.store(false, Ordering::SeqCst);
                if generation.load(Ordering::SeqCst) == current_generation {
                    flashing.store(false, Ordering::SeqCst);
                }
                break;
            }

            showing_blank.store(next_showing_blank, Ordering::SeqCst);
        }
    });
}

/// 设置主托盘图标。
fn set_tray_icon<R: Runtime>(app: &AppHandle<R>, icon: &Image<'static>) -> CommandResult<()> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| command_error("TRAY_ICON_MISSING", "Main tray icon is missing"))?;

    tray.set_icon(Some(icon.clone()))
        .map_err(|err| to_command_error("TRAY_ICON_SET_FAILED", err))
}

/// 创建透明空白托盘图标。
fn create_blank_icon() -> Image<'static> {
    let rgba = vec![0; (BLANK_ICON_SIZE * BLANK_ICON_SIZE * 4) as usize];
    Image::new_owned(rgba, BLANK_ICON_SIZE, BLANK_ICON_SIZE)
}
