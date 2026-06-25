# screenshot Feature

## 定位
截图功能模块 — 触发屏幕截图、获取截屏数据、完成或取消截图操作。

## 边界
- 负责：调用 Tauri 原生截图命令、展示截图覆盖层 UI。
- 不负责：图片的后续编辑、发送或存储（由 chat message-flow/upload 等上层消费方负责）。

## 入口
- `api.ts` — `getScreenshotCapabilities()` / `createScreenshotCapabilities()`
- `routes.ts` — `ScreenshotOverlayPage`（路由 `/screenshot-overlay`）

## 数据来源
通过 Tauri `invoke` 调用原生截图命令（`start_screenshot`、`get_screenshot_data`、`finish_screenshot`、`cancel_screenshot`），返回 `ScreenCapture[]` 数据。
