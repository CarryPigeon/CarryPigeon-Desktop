# 跨仓联调问题清单（仅客户端本轮可修）

约束：**不修改服务端仓库任何文件**。下列服务端问题只记录证据与建议归属，不提交补丁。

协议真源：服务端 Controller / DTO / `RealtimeChannelHandler` > `carrypigeon-server/docs/api/API.md` > 客户端 adapter。忽略 TCP / `CPResponse.code`。

## 本轮已修（client）

### P0-1 PATCH 频道 204 导致治理改名空引用

- 两端路径：客户端 `src/features/chat/data/chat-api/httpChatApi.ts` `httpPatchChannel` → `httpChatApiPort.patchChannel` → `roomGovernanceService.updateChannelMeta`；服务端 `ChannelController.updateChannelProfile` 返回 **204**。
- 期望：PATCH 成功后客户端仍得到频道对象。
- 实际（修前）：`requestJson` 对 204 返回 `undefined`，`mapChatChannelWire` 读 `wire.cid` 抛错。
- 复现：`PATCH /api/channels/{cid}` body `{"name","brief"}` → 204；随后 `GET /api/channels/{cid}` → 200。
- 是否阻断：是（频道改名/改简介 UI）。
- 归属：client（已修：204/无 cid 时 GET 详情）。测试：`httpChatApi.test.ts`。

### P0-2 发送消息幂等头无效

- 两端路径：客户端 `httpSendChannelMessage` 原只发 `Idempotency-Key`；服务端 `ChannelMessageController.sendChannelMessage` 只把 `SendChannelMessageRequest.clientMessageId` 交给领域层。转发端点才读 `Idempotency-Key`。
- 期望：同一幂等键重复发送得到同一 `mid` 或 409。
- 实际（修前）：仅带头、两次 POST 得到不同 `mid`（201/201）。
- 复现：body 带相同 `client_message_id` → 两次 `mid` 相同；只带头 → 两个不同 `mid`。
- 是否阻断：是（弱网重试重复消息）。
- 归属：client（已修：把幂等键写入 body `client_message_id`，头仍保留）。测试：`httpChatApi.test.ts`。

### P0-3 下载 302 把 Bearer 带到 MinIO

- 两端路径：服务端 `FileController.download` 在对象无内容流时 **302** `Location` 预签名 URL（`MinioObjectStorageService.get` 只返回 metadata）。客户端 `useAuthedObjectUrl` / Tauri `download_file` 默认跟随重定向并带上 `Authorization`。
- 期望：同源下载带 Bearer；预签名第二跳**不带** Bearer，得到文件字节。
- 实际（修前）：MinIO XML `InvalidRequest`（multiple authentication types），HTTP 400。
- 复现：`GET /api/files/download/{share_key}` 不跟随 → 302；对 Location 无 Authorization GET → 200 `hello`。urllib/reqwest 默认跟随并转发 Bearer → 400。
- 是否阻断：是（附件/背景图/桌面下载）。
- 归属：client（已修：`fetchAuthedBinary` `redirect:manual` 后无鉴权跟随；Tauri `download_file` `Policy::none` + 第二跳不带 Bearer）。测试：`fetchAuthedBinary.test.ts`。

## 服务端问题（记录，本轮不改）

### P0-S1 `around_mid` 500 `internal_error`

- 路径：`ChannelMessageController.getChannelMessages` → `ChannelMessageTimelineDomainApi` → `MessageMapper.findByChannelIdAfter`。
- 期望：200 窗口消息。
- 实际：500。`error.log`：`BadSqlGrammarException`，SQL 字面量 `AND message_id <![CDATA[ > ]]>` 发给 MySQL。`findByChannelIdBefore` 包在 `<script>` 里所以历史列表正常。
- 复现：`GET /api/channels/{cid}/messages?around_mid={mid}&before=5&after=5`。
- 是否阻断：是（跳转到消息上下文）。
- 归属：**server**。客户端无法适配。

### P0-S2 `Core:File` / `Core:Voice` 运行时未注册

- 路径：`ChannelMessagePluginRegistry.requireDomain` → `schema_invalid` / `domain is not supported`。`GET /api/plugins/catalog` 仅 `text`、`custom`；`GET /api/domains/catalog` 仅 `Core:Text`、`Core:Custom`。附件上传 200，send 422。
- 期望：storage 打开后可发送 File/Voice（插件配置默认 `fileEnabled`/`voiceEnabled` true，且 `@ConditionalOnBean(ObjectStorageService)`）。
- 实际：即使用 overlay 打开 storage 且 health passed，File/Voice 插件仍未进入 registry（疑似用户 `@Configuration` 早于 storage 自动配置评估 `ConditionalOnBean`）。
- 复现：`POST /api/channels/{cid}/messages` body `domain=Core:File` 或 `Core:Voice`。
- 是否阻断：是（文件/语音消息）。
- 归属：**server**。客户端不能把未注册 domain 打成 Text。

### P1-S1 邮件成功路径 503 `email_delivery_failed`

- 路径：`POST /api/auth/email_codes`、`PUT /users/me/email`。
- 期望：mail 打开后 204 并投递验证码。
- 实际：本环境 `cp.infrastructure.service.mail.enabled=true`、health passed，发信仍 503。错误码验证（无码/错码 422 `validation_failed`）已通过。
- 是否阻断：邮箱登录/改邮成功路径。
- 归属：server/ops（SMTP 与 JavaMail 投递，非客户端协议）。blocked，不是客户端 bug。

### P1-S2 有依赖数据时删除频道 409

- `channel_delete_blocked`：频道上有申请/消息/审计时不能物理删除。空频道 DELETE 204，再 DELETE 404 `not_found`。
- 归属：server 契约。首轮 harness 在 reject 申请后的频道上删，属用例问题，不是客户端缺陷。

### P1 客户端多出、服务端无路由（按计划不补服务端）

| 能力 | 实测 | 客户端现状 |
| --- | --- | --- |
| `POST/DELETE .../messages/{mid}/reactions` | 404 `not_found` | 保留调用；UI 需能消化 404 |
| `GET /files/list`、`GET /files/uploaders` | 404 | list 已降级空列表 |
| `POST /files/delete`、`/files/batch-delete` | 404 | 会抛错文案 |

归属：docs/product。不把它们当成服务端必须实现。

## P2 文档 / mock

- 客户端 `docs/客户端开发指南.md`、`docs/api/README.md` 仍写 TCP/`CPResponse`。不回写 `docs/`（计划禁止升格 SOP）。
- protocol mock 仍走硬删除、无 recall。不拿 mock 当联调通过。

## 已核销的预研风险

| 项 | 结论 |
| --- | --- |
| vendor Accept 406 | **否**。`GET /api/server` vendor Accept 200。 |
| 公开资料缺 email/bio/background_url | 服务端只有 uid/nickname/avatar；客户端字段可选，不崩。 |
| 注册发 token | 201 仅 `{uid,username}`。客户端已按此处理。 |
| WS 打到 8080 | 必须用 `ws_url`（18080）。auth/ping/reauth/resume 与双账号事件已通。 |
| 默认 mail/storage 关闭 | 联调用本地 overlay 打开；不入库。 |

## WebSocket（双账号，修 harness 后）

B 在线收 A 的事件：**pass**：`message.created` / `recalled` / `pinned` / `unpinned` / `mention.created` / `read_state.updated` / `channel.changed`。首轮失败是因为：(1) 先踢 B 再自提及导致 422；(2) recv 超时立刻 break。不是协议缺失。

超时未 auth：10s 后 `auth.err` `authentication_timeout`。

`message.deleted` 服务端不发：客户端兼容映射不误伤。

## 客户端未接、服务端有

用脚本打通，记缺口：邀请/接受邀请/所有权转移无 HTTP（`HttpRouteContractTests`）。不作为客户端调用失败。

上线前对照（2026-08-25）：服务端 **53 条 HTTP 都有 adapter**，但有 5 条没接到产品路径，等于用户测不到：

- `GET /api/channels/discover`（`createHttpChannelDiscoveryApi` 无 import）
- `GET /api/audit_logs`（`createHttpAuditLogApi` 无 import）
- `GET /api/mentions`、`PUT /api/mentions/{id}/read`、`PUT /api/mentions/read_state`（port 有，NotificationBell 不调用）

另：「创建好友私聊」弹窗无 `@created` 处理；联系人搜索误用 `GET /api/users?ids=`。详见 `server-api-client-gap.md`。

## 建议后续（需另开确认，且属服务端）

1. 修复 `findByChannelIdAfter` SQL（去掉未包 `<script>` 的 CDATA）。
2. 保证 storage 启用时 File/Voice `ChannelMessagePluginRegistration` 真正注册。
3. send 是否要读 `Idempotency-Key` 与转发端点对齐（可选；客户端已改走 body）。
4. 邮件投递链路（JavaMail ↔ SMTP）。

本轮均未做。
