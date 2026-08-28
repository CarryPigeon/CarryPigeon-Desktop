# channel-discovery

频道发现子功能模块。

## 定位

- **负责：** 查询可发现的公开频道列表，支持搜索和分页。
- **不负责：** 频道加入/退出（由 `room-governance` 负责）、频道创建（由 `room-governance` 负责）、已加入目录（由 `room-session` 负责）。

## 阅读顺序

1. `api.ts` — capability 入口
2. `api-types.ts` — 领域 capability 契约
3. `domain/contracts.ts` — 领域模型
4. `data/httpChannelDiscoveryApi.ts` — HTTP 适配器
5. `capability-source.ts` — 本地投影与 capability 组装
