# notification-preferences

免打扰模式 / 通知偏好子功能模块。

## 定位

- **负责：** 服务器级和频道级的通知偏好管理（免打扰模式），包括获取、设置服务器偏好和频道偏好。
- **不负责：** 桌面通知的实际触发（由 `tray-notification` 负责）、通知消息生成（由 `message-flow` 的 `notificationDecider` 负责）。

## 阅读顺序

1. `api.ts` — API 契约类型
2. `api-types.ts` — 传输层类型定义
3. `domain/contracts.ts` — 领域模型
4. `capability-source.ts` — Vue 响应式能力源
5. `data/httpNotificationPreferenceApi.ts` — HTTP 适配器实现
