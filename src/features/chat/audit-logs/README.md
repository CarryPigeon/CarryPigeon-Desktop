# audit-logs

审计日志子功能模块。

## 定位

- **负责：** 查询频道审计日志（`GET /api/audit_logs`）。
- **不负责：** 审计日志实时推送、治理动作执行。

## 阅读顺序

1. `api.ts` — capability 入口
2. `domain/contracts.ts` — 领域模型
3. `data/httpAuditLogApi.ts` — HTTP 适配器
4. `presentation/pages/ChannelAuditLogsPage.vue`
