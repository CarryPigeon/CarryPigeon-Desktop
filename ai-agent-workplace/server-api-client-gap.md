# 上线前：服务端 API vs 客户端实现缺口

核对日期：2026-08-25  
范围：服务端全部 `*Controller.java` + `RealtimeChannelHandler` ∪ 客户端 `http*.ts` / `wsChatEvents.ts` / 实际 UI 调用链。  
不改服务端。协议真源仍是服务端源码。

结论先说：**服务端已暴露的 53 条 HTTP 路由，客户端都有对应 adapter。**  
上线测试真正会踩空的，不是「完全没写 HTTP 客户端」，而是三类：

1. adapter 写了但产品路径没接上（用户点不到 / 点了也不打真实接口）
2. 服务端 **domain 有、HTTP 故意没暴露**（`HttpRouteContractTests` 明确禁止）
3. 客户端多出来的接口（打真服 404）

---

## 0. 服务端 HTTP 全集（53）与客户端对照

### 已接到产品路径（上线可测）

| Method | Path | 客户端入口 | UI / 运行时 |
| --- | --- | --- | --- |
| GET | `/api/server` | `httpServerInfoPort.ts` | 登录「连接」 |
| POST | `/api/gates/required/check` | `requiredGatePort.ts` | 登录准备 / required-setup |
| GET | `/api/plugins/catalog` | `httpPluginCatalog.ts` | 插件中心 / 登录准备 |
| GET | `/api/domains/catalog` | `httpDomainCatalog.ts` | 消息 domain 目录 |
| POST | `/api/auth/register` | `httpAuthServicePort.ts` | 注册页 |
| POST | `/api/auth/login` | 同上 | 登录页密码 |
| POST | `/api/auth/email_codes` | `httpEmailServicePort.ts` | 邮箱验证码 |
| POST | `/api/auth/tokens` | `httpAuthServicePort.ts` | 邮箱登录 |
| POST | `/api/auth/refresh` | `authSessionManager.ts` | token 刷新 |
| POST | `/api/auth/revoke` | 同上 | 登出 |
| GET | `/api/users/me` | `httpUserApi.ts` | 会话恢复 / 资料页 |
| GET | `/api/users/{uid}` | 同上 | 资料 |
| GET | `/api/users?ids=` | 同上 | 成员名批量拉取；联系人页误用作搜索 |
| PUT | `/api/users/me/email` | 同上 | 资料页改邮箱 |
| PATCH | `/api/users/me` | 同上 | 资料页保存 |
| POST | `/api/users/me/background` | 同上 | 资料页背景图 |
| GET | `/api/channels` | `httpChatApi.ts` | 进聊天拉列表 |
| GET | `/api/channels/{cid}` | 同上 | PATCH 204 后补拉；进房 |
| POST | `/api/channels` | 同上 | 「新建群聊」 |
| PATCH | `/api/channels/{cid}` | 同上 | 频道信息「编辑/保存」 |
| DELETE | `/api/channels/{cid}` | 同上 | 删除频道 |
| GET | `/api/channels/{cid}/members` | 同上 | 成员页 |
| PUT/DELETE | `/api/channels/{cid}/admins/{uid}` | 同上 | 设/撤管理员 |
| DELETE | `/api/channels/{cid}/members/{uid}` | 同上 | 踢人（无独立「退出频道」） |
| PUT/DELETE/GET | `/api/channels/{cid}/bans/...` | 同上 | 封禁页 |
| POST/GET | `/api/channels/{cid}/applications` | 同上 | 申请加入 / 申请列表 |
| POST | `.../applications/{aid}/decisions` | 同上 | 审批 |
| PUT | `/api/channels/{cid}/read_state` | 同上 | 读状态上报 |
| GET | `/api/unreads` | 同上 | 未读聚合 |
| GET | `/api/channels/{cid}/messages` | 同上 | 历史；`around_mid` 会打但服务端 SQL 500 |
| GET | `/api/channels/{cid}/messages/search` | 同上 | 频道内搜索 |
| POST | `/api/channels/{cid}/messages` | 同上 | 发送（幂等写 `client_message_id`） |
| POST | `.../messages/attachments` | 同上 | 附件/语音上传 |
| POST | `.../messages/{mid}/recall` | 同上 | 右键撤回 |
| POST | `/api/messages/{mid}/forward` | 同上 | 右键转发（live 不走 store，走 port） |
| POST/DELETE/GET | `/api/channels/{cid}/pins/...` | 同上 | 右键置顶 / 置顶条 |
| POST | `/api/files/uploads` | `httpFileApi.ts` | 两段式上传申请 |
| PUT | `/api/files/uploads/{shareKey}` | 同上 | 同源 PUT 内容 |
| GET | `/api/files/download/{shareKey}` | `fetchAuthedBinary` / Tauri | 头像/附件；302 不带 Bearer |
| GET | `/api/notification_preferences` | `httpNotificationPreferenceApi.ts` | 频道静音 store `refresh` |
| PUT | `/api/notification_preferences/server` | 同上 | 服务级偏好（server rail） |
| PUT | `/api/channels/{cid}/notification_preference` | 同上 | 频道右键通知级别 |

### Adapter 有、产品路径没接上（上线点不到真接口）

| Method | Path | Adapter | 缺口 |
| --- | --- | --- | --- |
| GET | `/api/channels/discover` | `httpChannelDiscoveryApi.ts` `createHttpChannelDiscoveryApi` | **没有任何 composition/UI import。** `ChannelRail` 注释写明 discover 要走该接口，但 Tab UI 已拿掉，目录只对本地 `GET /channels` 做 `joined` 过滤。公开频道发现/搜索 **测不到**。 |
| GET | `/api/audit_logs` | `httpAuditLogApi.ts` `createHttpAuditLogApi` | 同样 **未被 import**。无审计日志页。 |
| GET | `/api/mentions` | `httpChatApi.ts` → `httpChatApiPort` → `chatRootServices` | 停在 composition。`NotificationBell` 走本地 notifications store，**从不调用** `listMentions`。 |
| PUT | `/api/mentions/{id}/read` | 同上 | 无 UI |
| PUT | `/api/mentions/read_state` | 同上 | 无 UI |

这 5 条是「服务端有、客户端 HTTP 层写了、上线用户路径等于没实现」。

---

## 1. 服务端 domain 有、HTTP 明确未暴露（客户端无法实现）

`HttpRouteContractTests` 断言下列旧路径 **不得** 再出现。领域层仍有实现，但上线客户端打不到。

| 领域能力 | 领域 API | 已删除/未暴露的 HTTP | 客户端现状 |
| --- | --- | --- | --- |
| 用户关键字搜索 | `UserProfileApi.searchUserProfiles` | `GET /api/users/search`、`GET /api/users/page` | 联系人页把搜索词当 `ids` 去打 `GET /api/users?ids=`。输入昵称会 **422**（不是雪花 ID）。只能碰巧在用户粘贴 uid 时命中。 |
| 私聊专用创建 | `ChannelLifecycleApi.createPrivateChannel` | `POST /api/channels/private` | 「创建好友私聊」弹窗 **没有 `@created` 处理**，确认后什么都不提交。`POST /api/channels` 实际内部复用 private channel 逻辑，但 UI 没接到这条。 |
| 邀请成员 | `ChannelApplicationFlowApi.inviteChannelMember` | `POST /api/channels/{}/invites` | 无入口 |
| 接受邀请 | `acceptChannelInvite` | `POST /api/channels/{}/invites/accept` | 无入口 |
| 所有权转移 | `ChannelGovernanceApi.transferChannelOwnership` | `POST /api/channels/{}/ownership-transfer` | 无入口 |
| 成员禁言（非封禁） | `muteChannelMember` / `unmute` | `POST/DELETE .../members/{}/mute` | 客户端用的是 **bans** 封禁 API，不是 mute |
| 频道公告 | 无 HTTP 字段 | PATCH 只收 `name`+`brief` | 客户端已主动拒绝 `updateAnnouncement` |
| 默认/系统频道查询 | — | `GET /api/channels/default`、`/system` | 无 |

这些 **不要写进上线测试用例**，除非先开服务端 HTTP。

---

## 2. 客户端多出来的接口（真服 404）

上线应视为「客户端功能超前」，不要当服务端回归失败。

| Method | Path | 行为 |
| --- | --- | --- |
| POST | `/api/channels/{cid}/messages/{mid}/reactions` | 表情回应；404 |
| DELETE | 同上 `?emoji=` | 取消回应；404 |
| GET | `/api/files/list` | 文件库；404 → 空列表（已降级） |
| POST | `/api/files/delete` | 404 |
| POST | `/api/files/batch-delete` | 404 |
| GET | `/api/files/uploaders` | 404 → 空 |

WS 客户端还兼容 `message.deleted` / `message.updated` / `message.reactions_updated` / `audit_log.created`，服务端 **从不发布**。忽略即可。

---

## 3. 字段级缺口（路由通，语义不全）

| 接口 | 服务端 | 客户端 | 上线影响 |
| --- | --- | --- | --- |
| `PATCH /api/users/me` | 可选 `sex`、`birthday`（缺省 0） | 只发 `username/avatar/brief` | 性别/生日 UI 不存在，可接受 |
| `GET /api/users/me` | 仅 `uid,email,nickname,avatar` | 资料页有简介/背景草稿 | **简介写得进去，刷新后读不回来**；背景 URL 同样不回读 |
| `GET /api/users/{uid}` | 仅 `uid,nickname,avatar` | 类型里还有 email/bio/background | 公开资料看不到简介 |
| `POST /api/channels` | `name` + **必填** `brief`、`avatar` | 会发空字符串，满足 NotNull | 创建时不能设头像（空 avatar） |
| `PATCH /api/channels/{cid}` | 仅 `name`+`brief` | 不发 avatar | 频道头像改不了 |
| `GET /api/plugins/catalog` | `download.url` **恒为 null** | 插件安装走本地/仓库，不靠该 URL | 不能从服务端目录下载插件包 |
| `GET /api/channels/{cid}/messages?around_mid=` | 实现了但 SQL CDATA 导致 **500** | `httpListChannelMessagesAround` 会调用 | 跳转到搜索命中消息会炸 |
| `POST .../messages` domain `Core:File`/`Core:Voice` | catalog 运行时可能只有 text/custom | 附件上传 200 后 send 422 | 文件/语音消息发不出 |

---

## 4. WebSocket

服务端入站只认：`auth` / `reauth` / `ping`。其它命令回 `command.err` `unsupported realtime command`。  
客户端已实现这三条，并处理 `auth.ok/err`、`reauth.ok/err`、`pong`、`event`、`resume.failed`、通用 `command.err`（含 `idle_timeout`）。

已落地事件（两端对齐）：

- `message.created` / `message.recalled`
- `message.pinned` / `message.unpinned`
- `mention.created`
- `read_state.updated`
- `channel.changed` / `channels.changed`

无「服务端推了、客户端完全不接」的事件类型。  
`mention.created` 会进时间线映射，但 **没有提及收件箱页面** 消费 `GET /api/mentions`。

---

## 5. 上线测试建议（按优先级）

**可以测（已接通）：** 发现服务器、密码注册/登录、资料改名/改邮箱、建群、改频道名简介、发文本、撤回、转发、置顶、踢人/管理员、入群申请审批、封禁、频道通知级别、文件两段式上传+下载、WS 实时文本。

**不要当通过标准（服务端已知坏）：** `around_mid`、File/Voice 消息、本环境邮件验证码成功路径。

**点了等于没接服务端：** 频道发现、审计日志、提及收件箱、好友私聊弹窗、联系人按昵称搜索、频道公告、邀请/转让群主。

**点了会 404：** 消息表情、文件管理库（列表已降级为空，不要当成「没文件」的产品结论）。
