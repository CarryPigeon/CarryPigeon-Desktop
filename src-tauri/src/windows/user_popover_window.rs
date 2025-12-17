use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

/// 打开用户信息 Popover 窗口。
///
/// 设计目标：
/// - 避免“先闪一下再正常显示”：窗口创建前就确定 position/size。
/// - 避免在屏幕边缘/任务栏遮挡导致内容显示不全：根据显示器 work area 约束位置/尺寸。
///
/// 参数说明：
/// - `query`: 会拼到 `index.html?...` 的查询串，用于前端路由与数据传递。
/// - `x` / `y`: 期望弹窗出现的位置（通常来自鼠标点击的 `screenX/screenY`）。
/// - `width` / `height`: 期望弹窗大小（由前端预估传入）。
#[tauri::command]
pub async fn open_user_popover_window(
    app: AppHandle,
    query: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    // 同一时间只允许存在一个 popover。
    // 这里选择直接关闭旧窗口再创建新窗口，避免状态与 URL 不一致。
    if let Some(existing) = app.get_webview_window("user-popover") {
        let _ = existing.close();
    }

    // 最小窗口尺寸：避免传入 0 或极小值导致不可见/难以交互。
    let min_width = 160.0;
    let min_height = 80.0;

    // work area 边界留白：避免紧贴边缘产生“看起来被遮挡”的感觉。
    let margin = 8.0;

    // 先进行基本的尺寸归一化：
    // - clamp 到最小值
    // - ceil 以减少亚像素带来的抖动/模糊
    let mut width = width.max(min_width).ceil();
    let mut height = height.max(min_height).ceil();

    // 目标位置（会根据 work area 再修正）。
    let mut x = x;
    let mut y = y;

    // 尝试根据点击点找到对应显示器；找不到则 fallback 到主显示器。
    let monitor = app
        .monitor_from_point(x, y)
        .map_err(|e| e.to_string())?
        .or(app.primary_monitor().map_err(|e| e.to_string())?);

    if let Some(monitor) = monitor {
        // work_area 是“可用区域”（一般会排除任务栏/停靠栏）。
        // work_area 的 position/size 是物理像素，这里转换成逻辑像素与 x/y/width/height 一致。
        let scale_factor = monitor.scale_factor();
        let work_area = monitor.work_area();

        let work_x = work_area.position.x as f64 / scale_factor;
        let work_y = work_area.position.y as f64 / scale_factor;
        let work_w = work_area.size.width as f64 / scale_factor;
        let work_h = work_area.size.height as f64 / scale_factor;

        // 如果传入尺寸大于 work area，则收缩到最大可容纳范围。
        // 注意：这里仍保留 margin，确保不会“贴边”。
        let max_width = (work_w - margin * 2.0).max(1.0);
        let max_height = (work_h - margin * 2.0).max(1.0);

        width = width.min(max_width).ceil();
        height = height.min(max_height).ceil();

        let right = work_x + work_w;
        let bottom = work_y + work_h;

        // 如果在右/下边缘放不下，就优先翻转到左/上侧。
        // 这样在鼠标靠近边缘时弹窗仍能完整显示。
        if x + width > right - margin {
            x -= width;
        }
        if y + height > bottom - margin {
            y -= height;
        }

        // 最终 clamp：确保窗口完全落在 work area 范围内。
        let min_x = work_x + margin;
        let min_y = work_y + margin;
        let max_x = right - width - margin;
        let max_y = bottom - height - margin;

        x = if max_x >= min_x {
            x.clamp(min_x, max_x)
        } else {
            work_x
        };
        y = if max_y >= min_y {
            y.clamp(min_y, max_y)
        } else {
            work_y
        };
    }

    // 通过 query 传递给前端路由页面。
    let url = WebviewUrl::App(format!("index.html?{}", query).into());

    // 关键点：position/size 在 build 之前设置，避免窗口创建后再调整导致闪烁。
    let window = WebviewWindowBuilder::new(&app, "user-popover", url)
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .focusable(true)
        .focused(true)
        .position(x, y)
        .inner_size(width, height)
        // 兜底：在创建时再做一次“防溢出”检查。
        .prevent_overflow()
        .build()
        .map_err(|e| e.to_string())?;

    // 失焦自动关闭：popover 交互常用模式。
    let window_for_close = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::Focused(false) = event {
            let _ = window_for_close.close();
        }
    });

    let _ = window.set_focus();

    Ok(())
}
