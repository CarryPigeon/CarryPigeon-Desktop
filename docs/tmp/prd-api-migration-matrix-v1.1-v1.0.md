# 落地矩阵｜PRD v1.1 × API v1.0（客户端：CarryPigeon-Desktop）

更新时间：2026-02-04  
适用范围：本仓库（桌面客户端）  
对齐目标：
- PRD：`docs/design/PRD.md`（v1.1，2026-01-31）
- API：`docs/api/*`（v1.0 draft，2026-02-01）

> 说明：本矩阵只覆盖“客户端能落地/能验证”的部分；PRD/API 中明确属于服务端职责（例如 schema 强校验、硬删除后历史接口不再返回等）在此标记为“服务端待验证”。

状态标记：
- ✅ 已落地（客户端实现 + 有调用落点）
- ⚠️ 部分落地（实现存在，但未完全按文档语义/未形成闭环）
- ❌ 未落地（客户端缺实现或缺调用入口）
- 🟦 服务端待验证（客户端无法在本仓库内验证）

---

## 1. PRD（P0/P1）落地矩阵（面向验收）

| PRD 条目 | 关键语义/验收点 | 相关 API/协议 | 代码落点（证据） | 状态 | 备注/缺口 |
|---|---|---|---|---|---|
| 连接/握手/阶段拆分（PRD 2.3/7.3） | Handshake→Verify→Auth；失败原因分层 | `GET /api/server`（Verify） | `src/features/server-connection/connectivity/presentation/store/connectionStore.ts`、`src/features/server-connection/connectivity/data/tauriTcpConnector.ts`、`src-tauri/src/features/network/data/tcp_real.rs`、`src/shared/net/http/httpJsonClient.ts`、`src-tauri/src/features/network/usecases/api_usecases.rs`、`src/features/chat/presentation/store/liveChatStore.ts`、`src-tauri/src/features/plugins/data/plugin_store.rs`、`src/features/plugins/presentation/runtime/pluginRuntime.ts`、`src/features/plugins/data/tauriPluginManager.ts` | ⚠️ | native 连接已支持 strict/insecure/trust_fingerprint（三种 TLS 策略）；当用户选择 insecure/fingerprint 且走 HTTPS 时：HTTP `/api/*` 会通过 Tauri（Rust reqwest）按 TLS policy 请求；WS 因 WebView 无法绕过证书校验会自动降级为 HTTP polling（仍可用，但实时性降低）。同源的插件下载与插件 `host.network.fetch` 也会遵循相同 TLS policy（cross-origin 仍拒绝/严格）。 |
| server_id 隔离（PRD 3.1/8.4） | `server_id` 稳定；本地数据按 server_id 隔离 | `GET /api/server` 返回 `server_id` | `src/shared/serverIdentity.ts`、`src/features/server-connection/server-info/data/httpServerInfoPort.ts`、`src/features/chat/presentation/pages/MainPage.vue` | ⚠️ | 若服务端缺少 `server_id`：核心聊天仍可用；插件中心已锁定，主界面也会跳过插件 runtime 加载（避免错误），但插件能力整体降级。 |
| Required Gate（PRD 5.6/7.1） | 未满足 required：阻止登录；引导安装 | `POST /api/auth/tokens` 412 + `required_plugin_missing`；`POST /api/gates/required/check` | `src/features/account/auth-flow/data/httpAuthServicePort.ts`、`src/features/account/auth-flow/data/requiredGateService.ts`、`src/features/account/auth-flow/presentation/pages/RequiredSetupPage.vue` | ✅ | Gate 判定“服务端为准”，客户端同时展示本地安装态。 |
| 插件目录发现（PRD 4.6） | 拉取 server catalog（含 required、provides_domains、下载指针） | `GET /api/plugins/catalog` | `src/features/plugins/data/httpPluginCatalog.ts`、`src/features/plugins/presentation/store/pluginCatalogStore.ts` | ✅ | Repo catalog（第三方仓库）也已支持（客户端直连）。 |
| 插件生命周期（PRD 4.6/10.2） | install/enable/disable/update/rollback；enable 失败需回滚/保留旧版 | 客户端本地策略（API 仅提供下载指针） | `src/features/plugins/presentation/store/pluginInstallStore.ts`、`src/features/plugins/data/tauriPluginManager.ts`、`src-tauri/src/features/plugins/data/plugin_store.rs` | ✅ | 更新/切换前先 try-load 校验；失败触发回滚/标记 failed；当 server 使用自签/指纹信任时，同源下载会按 rack TLS policy 进行（insecure/fingerprint）。 |
| 插件权限：network 同源限制（PRD 5.5/8.1/10.2-8） | 插件网络访问仅限当前 server origin | Host API（Tauri command） | `src/features/plugins/presentation/runtime/pluginRuntime.ts`、`src-tauri/src/features/plugins/data/plugin_store.rs`（`network_fetch`） | ✅ | Rust 侧强制 same-origin（scheme/host/port）；同源 HTTPS 时遵循 rack TLS policy（insecure/fingerprint），避免自签证书导致插件网络能力不可用。 |
| 插件权限：storage 默认提供（PRD 5.5/10.2-9） | storage 不需要声明；按 server_id 隔离 | Host API（Tauri command） | `src/features/plugins/presentation/runtime/pluginRuntime.ts`、`src-tauri/src/features/plugins/data/plugin_store.rs`（storage get/set） | ✅ | 隔离细节由 Rust side 落地。 |
| 未知 domain 降级（PRD 7.2/10.3-13） | 优先 preview；不泄露 data 全量；一键安装 | message payload `preview` + provides_domains | `src/features/chat/presentation/components/messages/UnknownDomainCard.vue`、`src/features/chat/presentation/store/liveChatStore.ts` | ✅ | pluginIdHint：优先来自 plugin catalog；缺失时回退到 Domain Catalog providers。 |
| 消息收发（PRD 4.4） | `Core:Text` + 插件 domain；幂等 key（推荐） | `POST /api/channels/{cid}/messages` + `Idempotency-Key` | `src/features/chat/data/httpChatApi.ts`、`src/features/chat/presentation/store/liveChatStore.ts` | ✅ | 已发送携带 `Idempotency-Key`。 |
| 回复（PRD 4.4/6.1） | `reply_to_mid`；引用不泄露已删内容 | `reply_to_mid` 字段 | `src/features/chat/presentation/store/liveChatStore.ts`、`src/features/chat/presentation/pages/MainPage.vue` | ✅ | 缺点：引用渲染只依赖本地列表，历史缺失时显示 “—”。 |
| 删除=消失（硬删除）（PRD 6.2/10.1-4） | 删除后 UI 移除；历史拉取也不可见 | `DELETE /api/messages/{mid}` + `message.deleted` | `src/features/chat/presentation/store/liveChatStore.ts`（delete + WS） | 🟦 | 客户端已移除；“历史接口不再返回”需服务端验证。 |
| 已读/未读（PRD 4.5） | `last_read_time` 前进；未读计数展示 | `PUT /api/channels/{cid}/read_state`、`GET /api/unreads` | `src/features/chat/presentation/store/liveChatStore.ts`、`src/features/chat/presentation/pages/MainPage.vue` | ⚠️ | 进入频道/发送消息/滚动到底部/窗口回前台都会 best-effort 上报（节流），并保证 `last_read_time` 只前进；当“用户在底部”且新消息到达时，会保持视口贴底并触发 best-effort 已读上报；仍可优化多端一致性与更细粒度策略。 |
| 历史消息分页（PRD 4.4/分页规范） | cursor/has_more；可加载更多 | `GET /api/channels/{cid}/messages?cursor&limit` | `src/features/chat/presentation/pages/MainPage.vue`、`src/features/chat/presentation/store/liveChatStore.ts` | ⚠️ | 已支持“Load older”且加载时保持滚动位置，并在滚动到顶部自动补拉；当未在底部且有新消息时，会出现“跳转到底部”按钮；仍缺长列表更系统的性能策略（如虚拟列表/分段缓存）。 |
| 断线恢复（PRD 7.3/分页规范 5） | WS resume；失败走 HTTP 补拉 | WS `resume.failed` | `src/features/chat/data/wsChatEvents.ts`、`src/features/chat/presentation/store/liveChatStore.ts` | ⚠️ | strict 模式：WS `auth` 携带 `resume.last_event_id`；客户端仅在事件处理成功后才前移 `last_event_id`，并对重复/乱序事件做忽略保护；`resume.failed` 会清空游标并触发 HTTP catch-up（channels+unreads + 当前频道 latest page + 少量未读频道 latest page）。非 strict 且 HTTPS 时：WS 会被禁用并改为 HTTP polling（因此无 resume 语义）。仍依赖服务端提供“事件回放窗口”以实现真正精确对齐。 |
| WS channel.changed（API 12） | scope 刷新提示：profile/members/... | `channel.changed` 事件 | `src/features/chat/presentation/store/liveChatStore.ts`、`src/shared/utils/messageEvents.ts` | ⚠️ | 已按 scope 做 best-effort：messages/members 直接补拉；applications/bans 通过 window event 触发管理页刷新；profile 仍主要依赖 `refreshChannels()` 更新模型。 |
| 文件上传/下载（PRD 4.7，P1） | 申请上传→直传；download URL | `POST /api/files/uploads`、`GET /api/files/download/{share_key}` | `src/features/files/data/httpFileApi.ts`、`src/features/files/presentation/store/fileUploadStore.ts`、`src/features/chat/presentation/pages/MainPage.vue` | ✅ | 当前用 Core:Text 占位语法 `[file:share_key]` 绑定消息；聊天页可点击下载/图片预览（完整“文件 domain 消息”仍可由插件提供）。 |
| Domain Catalog（PRD 6.4） | domains/versions/providers/contract 指针 | `GET /api/domains/catalog` | `src/features/plugins/data/httpDomainCatalog.ts`、`src/features/plugins/presentation/store/domainCatalogStore.ts`、`src/features/plugins/presentation/pages/DomainCatalogPage.vue`、`src/features/chat/presentation/pages/MainPage.vue` | ✅ | 主界面预加载用于 unknown-domain 提示；`/domains` 提供 contract/schema 指针发现入口（可复制 schema_url）。 |

---

## 2. API（HTTP/WS）端点落地矩阵（客户端调用面）

> 说明：本表关注“客户端是否具备调用能力 + 是否被 UI 使用”。

| API | 适配器/实现 | UI/Store 调用落点 | 状态 | 备注 |
|---|---|---|---|---|
| `GET /api/server` | `src/features/server-connection/server-info/data/httpServerInfoPort.ts` | 登录/主界面 refresh | ✅ | `ws_url` 会被 WS 客户端优先使用（若服务端提供）。 |
| `POST /api/gates/required/check` | `src/features/account/auth-flow/data/requiredGateService.ts` | RequiredSetupPage | ✅ | 用于“Recheck”。 |
| `GET /api/plugins/catalog` | `src/features/plugins/data/httpPluginCatalog.ts` | PluginCenter/RequiredSetup | ✅ | provides_domains 用于未知 domain 安装提示。 |
| `GET /api/domains/catalog` | `src/features/plugins/data/httpDomainCatalog.ts` | `src/features/plugins/presentation/store/domainCatalogStore.ts`（MainPage preload + Domains page）；liveChatStore unknown-domain hint | ✅ | Domains 页面展示 providers/constraints/contract（schema_url + sha256）。 |
| `POST /api/auth/email_codes` | `src/features/account/auth-flow/data/httpEmailServicePort.ts` | LoginPage | ✅ | |
| `POST /api/auth/tokens` | `src/features/account/auth-flow/data/httpAuthServicePort.ts` | LoginPage | ✅ | required gate 映射已做。 |
| `POST /api/auth/refresh` | `src/shared/net/auth/authSessionManager.ts` | Chat 自动 refresh + WS reauth | ✅ | 单飞（singleflight）避免风暴。 |
| `POST /api/auth/revoke` | `src/shared/net/auth/authSessionManager.ts` | Settings 清理/登出（best-effort） | ✅ | |
| `GET /api/channels` | `src/features/chat/data/httpChatApi.ts` | liveChatStore.refreshChannels | ✅ | |
| `GET /api/unreads` | `src/features/chat/data/httpChatApi.ts` | refreshChannels | ✅ | |
| `GET /api/channels/{cid}/messages` | `src/features/chat/data/httpChatApi.ts` | loadChannelMessages + loadMoreMessages | ⚠️ | 已支持顶部补拉与滚动位置保持；仍可优化长列表性能与“回到底部”体验。 |
| `POST /api/channels/{cid}/messages` | `src/features/chat/data/httpChatApi.ts` | sendComposerMessage | ✅ | |
| `DELETE /api/messages/{mid}` | `src/features/chat/data/httpChatApi.ts` | deleteMessage + WS | ✅ | |
| `PUT /api/channels/{cid}/read_state` | `src/features/chat/data/httpChatApi.ts` | selectChannel | ⚠️ | 上报时机可优化。 |
| Channels 管理（members/admins/applications/bans） | `src/features/chat/data/httpChatApi.ts` | 频道管理页路由 | ✅ | 主要在独立页面使用。 |
| `POST /api/files/uploads` | `src/features/files/data/httpFileApi.ts` | FileUploadButton | ✅ | |
| `GET /api/files/download/{share_key}` | `src/features/files/data/httpFileApi.ts`（URL builder） | `src/features/chat/presentation/pages/MainPage.vue`（解析 `[file:share_key]`） | ✅ | Core:Text 占位语法支持下载/图片预览；更完整的文件消息体验可由插件 domain 承担。 |
| WS `wss://{host}/api/ws` + auth/resume | `src/features/chat/data/wsChatEvents.ts` | liveChatStore.ensureChatReady | ⚠️ | strict 模式使用 WS（支持 ping、resume.failed 回退补拉）；当用户选择 insecure/fingerprint 且走 HTTPS 时，WS 会自动降级为 HTTP polling（避免自签证书握手失败）。 |
| WS `message.created/deleted/read_state.updated` | `src/features/chat/presentation/store/liveChatStore.ts` | 事件驱动刷新 | ✅ | `channel.changed` scope 仍需完善。 |

---

## 3. 下一步整改（建议按优先级）

1) **完善消息分页体验**：滚动保持、自动补拉策略、以及按需缓存策略（仍以 cursor 为准）。  
2) **完善 `channel.changed`**：按 `scope` 精细补拉（members/applications/bans/messages/profile）。  
3) **接入 Domain Catalog**：用于未知 domain 更精准的“缺哪个插件/版本”，并为插件开发者提供契约发现入口。  
4) **TLS 信任/严格校验策略**：把 “TLS strict/insecure” 从 UI 选择落到连接实现与错误原因上。  
