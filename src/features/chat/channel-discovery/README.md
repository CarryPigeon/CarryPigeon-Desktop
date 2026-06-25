# channel-discovery

频道发现子功能模块。

## 定位

- **负责：** 查询可发现的频道列表，支持搜索和分页。
- **不负责：** 频道加入/退出（由 `room-governance` 负责）、频道创建（由 `room-governance` 负责）。

## 阅读顺序

1. `api.ts` — API 契约类型
2. `api-types.ts` — 传输层类型定义
3. `domain/contracts.ts` — 领域模型
4. `data/httpChannelDiscoveryApi.ts` — HTTP 适配器实现
