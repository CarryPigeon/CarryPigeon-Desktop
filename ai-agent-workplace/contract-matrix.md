# 跨仓契约矩阵（客户端实际调用 ∪ 服务端 Controller/WS）

来源：服务端 `*Controller.java` / `RealtimeChannelHandler.java`；客户端 `http*.ts` / `wsChatEvents.ts`。  
判定列：`对齐` / `状态码或字段差` / `客户端多` / `服务端多` / `文档过时`。  
运行时列在 `feature-coverage-checklist.md`。

协议真源：服务端源码 > `docs/api/API.md` > 客户端 adapter。忽略 TCP/`CPResponse.code`。

## 全局

| 项 | 客户端 | 服务端 | 判定 |
| --- | --- | --- | --- |
| Base | `{origin}/api` | `/api` | 对齐 |
| JSON | snake_case | Jackson SNAKE_CASE | 对齐 |
| 雪花 ID | 十进制字符串 | `Ids.toString` | 对齐 |
| 成功 | 直接 JSON 或 204 | 资源对象或 204 | 对齐（个别端点见下） |
| 失败 | `{error:{status,reason,message,request_id,details}}` | `ApiErrorResponse` | 对齐 |
| Accept | `application/vnd.carrypigeon+json; version=1` | 文档推荐 `application/json`，未做媒体类型版本协商 | **对齐（实测）**：`GET /api/server` vendor Accept **200**；`Accept: text/plain` **406** `not_acceptable` |
| 鉴权 | `Authorization: Bearer` | 同；匿名名单见 `HttpAuthenticationConfiguration` | 对齐 |
| HTTP 端口 | 用户输入，loopback:8080→http | Spring 8080 | 对齐 |
| WS | `GET /server` 的 `ws_url` | Netty `127.0.0.1:18080/api/ws` | 对齐（禁止打 8080） |
| 客户端开发指南 TCP/CPResponse | 仍文档化 | 服务端已废弃 | **文档过时** |
| 服务端 AGENTS `CPResponse.code` 测试口径 | — | 与 `异常与错误码规范` 冲突 | **文档过时** |

匿名放行：`/api/server`、`/api/gates/required/check`、`/api/plugins/catalog`、`/api/domains/catalog`、`/api/files/download/server_avatar`、`/api/auth/{register,login,email_codes,tokens,refresh,revoke}`。

## A. 发现与门禁

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| GET | `/api/server` | `httpServerInfoPort.ts` | `ServerController` 200 `ServerDiscoveryDocument` | 对齐 |
| POST | `/api/gates/required/check` | `requiredGatePort.ts` | `PluginGateController` 200 `{missing_plugins}` | 对齐 |
| GET | `/api/plugins/catalog` | `httpPluginCatalog.ts` | `PluginCatalogController` | 对齐 |
| GET | `/api/domains/catalog` | `httpDomainCatalog.ts` | `DomainCatalogController` | 对齐 |
| POST | `/api/auth/tokens` + 缺插件 | `httpAuthServicePort.ts` | 412 `required_plugin_missing` | 对齐（需实测） |

## B. 鉴权

| Method | Path | Client 期望 | Server | 判定 |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/register` | 201 `{uid,username}` 无 token | `AuthController` 201 同 | 对齐 |
| POST | `/api/auth/login` | token 包 | 200 token 包 | 对齐 |
| POST | `/api/auth/email_codes` | 204 | 204；mail 关则 503 | 对齐 |
| POST | `/api/auth/tokens` | token 包 | 200 token 包 | 对齐 |
| POST | `/api/auth/refresh` | token 包 | 200 | 对齐 |
| POST | `/api/auth/revoke` | 204 | 204 | 对齐 |
| GET | `/api/users/me`（token 登录） | `{uid,email?,nickname?,avatar?}` | `UserMeResponse` 同四字段 | 对齐 |

Token JSON：`token_type,access_token,expires_in,refresh_token,uid,is_new_user`。

## C. 用户资料

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| GET | `/api/users/me` | 见上 | 见上 | 对齐 |
| GET | `/api/users/{uid}` | 可选 `email,bio,background_url` | `UserPublicProfileResponse` 仅 `uid,nickname,avatar` | **字段差**（多字段可选，通常不崩） |
| GET | `/api/users?ids=` | `{items:[]}` | `{items:[]}` 公开资料 | 对齐 |
| PATCH | `/api/users/me` | 必填 username/avatar/brief，期望 204 | `@NotBlank username` `@NotNull avatar,brief` 204 | 对齐 |
| PUT | `/api/users/me/email` | 204 | 204 | 对齐 |
| POST | `/api/users/me/background` | `{background_url}` multipart `background` | 同 | 对齐（需 storage） |

## D. 频道生命周期

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| GET | `/api/channels` | `{channels:[]}` | `{channels: ChannelSummaryResponse}` | 对齐 |
| GET | `/api/channels/{cid}` | `ChatChannelWire` | `ChannelSummaryResponse` | 对齐（客户端额外可选字段可忽略） |
| GET | `/api/channels/discover` | cursor page | cursor page | 对齐 |
| POST | `/api/channels` | JSON `ChatChannelWire`；body name/brief/avatar | 201 同结构；`CreateChannelRequest` 三者均 NotNull | 对齐 |
| PATCH | `/api/channels/{cid}` | `requestJson` 后若 204 则 `GET /channels/{cid}` | 204；`UpdateChannelProfileRequest` 要 name+brief | **状态码差，客户端已适配**：204 后补拉详情 |
| DELETE | `/api/channels/{cid}` | 204 | 204 | 对齐 |

## E. 治理

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| GET | `/api/channels/{cid}/members` | `{items}` `join_time` number | `ChannelMemberV1Response.joinTime` Instant→epoch ms | 对齐 |
| PUT | `/api/channels/{cid}/admins/{uid}` | 204 | 204 | 对齐 |
| DELETE | `/api/channels/{cid}/admins/{uid}` | 204 | 204 | 对齐 |
| DELETE | `/api/channels/{cid}/members/{uid}` | 204 | 204 | 对齐 |
| POST | `/api/channels/{cid}/applications` | void/忽略 body | 200 申请对象 | 对齐（客户端忽略 JSON） |
| GET | `/api/channels/{cid}/applications` | `{items}` | 同 | 对齐 |
| POST | `.../applications/{aid}/decisions` | void | 200 申请对象 | 对齐（客户端忽略 JSON） |
| PUT | `/api/channels/{cid}/bans/{uid}` | ban JSON | `ChannelBanV1Response` | 对齐 |
| DELETE | `/api/channels/{cid}/bans/{uid}` | 204 | 204 | 对齐 |
| GET | `/api/channels/{cid}/bans` | `{items}` | 同 | 对齐 |
| PUT | `/api/channels/{cid}/notification_preference` | 204 | 204 | 对齐 |

无 HTTP：邀请、接受邀请、所有权转移（domain 有、`HttpRouteContractTests` 确认未暴露）。记服务端能力缺口，不作为客户端调用失败。

## F. 消息

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| GET | `/api/channels/{cid}/messages` | page；支持 cursor/around_mid | 同 | 对齐 |
| GET | `/api/channels/{cid}/messages/search` | q 等 | q/keyword | 对齐 |
| POST | `/api/channels/{cid}/messages` | 200/201 消息；幂等写入 body `client_message_id`（并仍带 `Idempotency-Key` 头） | 201；send **只读** body `client_message_id` | **已适配**：原先只发头导致不幂等 |
| POST | `.../messages/attachments` | multipart file+message_type | 同 | 对齐 |
| POST | `.../messages/{mid}/recall` | 更新后消息 | 撤回后消息 | 对齐 |
| POST | `/api/messages/{mid}/forward` | 消息 | 201 `Core:Forward` | 对齐 |
| POST | `.../pins/{mid}` | void | 200 pin 对象 | 对齐（客户端忽略 JSON） |
| DELETE | `.../pins/{mid}` | 204 | 204 | 对齐 |
| GET | `.../pins` | cursor page | 同 | 对齐 |
| GET | `/api/mentions` | page | 同 | 对齐 |
| PUT | `/api/mentions/{id}/read` | 204 | 204 | 对齐 |
| PUT | `/api/mentions/read_state` | 204 | 204 | 对齐 |
| PUT | `/api/channels/{cid}/read_state` | JSON | 200 `ChannelReadStateResponse` | 对齐 |
| GET | `/api/unreads` | `{items}` 可选 mention_unread_count | `{cid,unread_count,last_read_time}` | 对齐（额外字段可选） |
| POST/DELETE | `.../messages/{mid}/reactions` | JSON reactions | **无路由** | **客户端多** |

可发送 domain：`Core:Text` `Core:ReplyText` `Core:File` `Core:Voice`；`Core:Forward` 仅转发端点；`Core:System` 通用 send 应拒绝。

## G. 文件 / 通知 / 审计

| Method | Path | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| POST | `/api/files/uploads` | descriptor | `FileUploadResponse` | 对齐 |
| PUT | `/api/files/uploads/{shareKey}` | 跟 descriptor.url | 204 | 对齐 |
| GET | `/api/files/download/{shareKey}` | `fetchAuthedBinary`：同源带 Bearer、`redirect:manual`，302 后无鉴权跟随 Location；Tauri `download_file` 同策略 | 200 二进制或 **302 预签名** | **已适配**：跟随 302 时不得把 Bearer 带到 MinIO |
| GET | `/api/files/list` | 404→空列表 | 无 | **客户端多**（已降级） |
| POST | `/api/files/delete` | 404→抛错文案 | 无 | **客户端多** |
| POST | `/api/files/batch-delete` | 同上 | 无 | **客户端多** |
| GET | `/api/files/uploaders` | 404→空 | 无 | **客户端多** |
| GET | `/api/notification_preferences` | `{server,channels}` | 同 | 对齐 |
| PUT | `/api/notification_preferences/server` | 204 | 204 | 对齐 |
| GET | `/api/audit_logs` | cursor page | 同 | 对齐 |

## H. WebSocket

| 方向 | type | Client | Server | 判定 |
| --- | --- | --- | --- | --- |
| C→S | `auth` | data: api_version, access_token, device_id, resume? | 读 access_token/device_id/resume；忽略 api_version | 对齐（多余字段可忽略） |
| C→S | `reauth` | access_token | 同 | 对齐 |
| C→S | `ping` | 无 body | `pong` | 对齐 |
| S→C | `auth.ok`/`reauth.ok` | uid/expires_at/server_id | 同 | 对齐 |
| S→C | `auth.err`/`reauth.err` | reason | 同 | 对齐 |
| S→C | `event` | event_id/event_type/server_time/payload | 同 | 对齐 |
| S→C | `resume.failed` | 清 cursor + HTTP 补拉 | 内存窗口 miss | 对齐 |
| S→C | `message.created` | 映射 | 已实现 | 对齐 |
| S→C | `message.recalled` | 映射 | 已实现 | 对齐 |
| S→C | `message.pinned`/`unpinned` | 映射 | 已实现 | 对齐 |
| S→C | `mention.created` | 映射 | 已实现 | 对齐 |
| S→C | `read_state.updated` | 映射 | 已实现 | 对齐 |
| S→C | `channel.changed` | 映射 | scope: profile/members/applications/bans/messages | 对齐 |
| S→C | `channels.changed` | 映射 | 已实现 | 对齐 |
| S→C | `message.deleted`/`updated`/`reactions_updated`/`audit_log.created` | 兼容映射 | **不发布** | 客户端多（兼容，不误伤即可） |

## I. Mock / 文档漂移（不计入真服通过）

- protocol mock 仍实现硬删除 `message.deleted`，无 `/recall`。
- 客户端 `docs/客户端开发指南.md` §2–5 仍是 TCP。
- 客户端 `docs/api/README.md` 写“当前实现链路 TCP”。

## 静态+运行时结论摘要

P0 已修（仅客户端）：PATCH 频道 204 补 GET；发送消息把幂等键写入 `client_message_id`；下载 302 不携带 Bearer。

P0 服务端（本轮不改服务端）：`around_mid` SQL CDATA 导致 500；`Core:File`/`Core:Voice` 运行时未注册（catalog 仅 `text`/`custom`），`domain is not supported`。

P1：reactions / 文件库 404（预期）；公开资料缺字段（客户端可选，不崩）；邮件成功路径本环境 503。

P2：文档 TCP/`CPResponse`；mock 与真服 recall/delete 不一致。
