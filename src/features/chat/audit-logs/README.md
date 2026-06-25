# audit-logs

审计日志子功能模块。

## 定位

- **负责：** 查询频道的审计日志记录（频道操作、管理操作、消息管理操作等）。
- **不负责：** 审计日志的实时推送（实时事件由 `chatEventRouter` 统一处理）、操作执行（由 `room-governance` 和 `message-flow` 各自负责）。

## 阅读顺序

1. `api.ts` — API 契约类型
2. `api-types.ts` — 传输层类型定义
3. `domain/contracts.ts` — 领域模型
4. `data/httpAuditLogApi.ts` — HTTP 适配器实现
