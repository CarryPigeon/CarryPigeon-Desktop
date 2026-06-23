//! screenshot｜截屏核心逻辑
//!
//! 约定：注释中文，日志英文（tracing）。
use serde::Serialize;
use xcap::Monitor;

/// 单个显示器的截图结果
#[derive(Debug, Serialize)]
pub struct ScreenCapture {
    /// 显示器 ID
    pub monitor_id: u32,
    /// 截图宽度（物理像素）
    pub width: u32,
    /// 截图高度（物理像素）
    pub height: u32,
    /// 显示器在虚拟桌面中的 X 坐标
    pub x: i32,
    /// 显示器在虚拟桌面中的 Y 坐标
    pub y: i32,
    /// DPI 缩放因子
    pub scale_factor: f64,
    /// PNG 编码后的图片数据（base64）
    pub data_base64: String,
}

/// 截取所有显示器的画面。
pub fn capture_all_screens() -> Result<Vec<ScreenCapture>, String> {
    let monitors = Monitor::all().map_err(|e| format!("capture_all_screens monitor list failed: {e:?}"))?;

    let mut captures = Vec::new();
    for monitor in &monitors {
        let image = monitor.capture_image().map_err(|e| format!("capture_all_screens capture_image failed: {e:?}"))?;

        let width = image.width();
        let height = image.height();

        let mut png_bytes = Vec::new();
        let mut cursor = std::io::Cursor::new(&mut png_bytes);
        image
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("capture_all_screens png encode failed: {e:?}"))?;

        let data_base64 = use_base64_encode(&png_bytes);

        captures.push(ScreenCapture {
            monitor_id: monitor.id().map_err(|e| format!("monitor id failed: {e:?}"))?,
            width,
            height,
            x: monitor.x().map_err(|e| format!("monitor x failed: {e:?}"))?,
            y: monitor.y().map_err(|e| format!("monitor y failed: {e:?}"))?,
            scale_factor: monitor.scale_factor().map_err(|e| format!("monitor scale_factor failed: {e:?}"))? as f64,
            data_base64,
        });
    }

    Ok(captures)
}

/// base64 编码（手动实现，避免引入 base64 crate 导致版本冲突）。
fn use_base64_encode(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity(data.len() * 4 / 3 + 4);
    let mut i = 0;
    while i < data.len() {
        let b0 = data[i] as usize;
        let b1 = data.get(i + 1).copied().unwrap_or(0) as usize;
        let b2 = data.get(i + 2).copied().unwrap_or(0) as usize;
        result.push(CHARS[(b0 >> 2) & 0x3F] as char);
        result.push(CHARS[((b0 << 4) | (b1 >> 4)) & 0x3F] as char);
        if i + 1 < data.len() {
            result.push(CHARS[((b1 << 2) | (b2 >> 6)) & 0x3F] as char);
        } else {
            result.push('=');
        }
        if i + 2 < data.len() {
            result.push(CHARS[b2 & 0x3F] as char);
        } else {
            result.push('=');
        }
        i += 3;
    }
    result
}
