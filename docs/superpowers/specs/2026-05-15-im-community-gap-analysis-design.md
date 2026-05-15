# CarryPigeon 频道社群型 IM 功能缺口设计

日期：2026-05-15

## 背景与目标

CarryPigeon 当前已经具备频道群聊 MVP 的主链路：服务器连接、登录、频道列表、消息收发、回复、删除、已读未读、成员治理、入群申请、禁言、插件消息 domain、文件上传基础入口以及 WS/polling 恢复策略。

这份设计聚焦“对标 Discord/QQ 频道社群型 IM 时还缺什么”。目标不是立即实现所有功能，而是明确下一阶段最值得补齐的社群基础能力、优先级、架构落点和协议扩展方向。

本设计参考的外部产品能力包括 Discord 的 roles/permissions、threads/forum channels、announcement channels、AutoMod、scheduled events，以及 QQ 频道/机器人生态中的频道、权限和机器人服务集成方向。它们共同说明：频道社群型 IM 的核心不是单纯发消息，而是频道结构、权限治理、通知控制、成员运营和生态扩展。

## 范围

本轮建议聚焦 6 个 P0 缺口：

1. 消息搜索。
2. @提及与提及收件箱。
3. 消息编辑、置顶、真正转发。
4. 频道分类与远端 discover。
5. 通知策略。
6. 审计日志基础版。

本轮明确不纳入：

1. 私聊和好友体系。
2. 语音、直播、舞台频道。
3. 论坛频道和完整 threads 系统。
4. 完整身份组与频道级权限矩阵。
5. AutoMod 完整规则引擎。
6. 机器人命令和 webhook 平台。

这些能力仍然重要，但会把范围从“补齐频道社群基础体验”扩大成平台级重构。

## 当前缺口总览

按 Discord/QQ 频道社群型产品对标，当前缺口可分成 7 组：

1. 社群结构缺口：缺频道分类、公告频道、论坛/帖子型频道、话题/线程、活动/舞台/语音频道。
2. 权限体系缺口：当前只有 owner/admin/member，缺身份组层级、频道级权限覆盖、可视化权限管理、审计日志。
3. 消息体验缺口：缺搜索、@提及、表情反应、消息编辑、置顶、消息链接、真正转发、收藏/稍后看、富媒体预览。
4. 通知缺口：缺服务器/频道静音、仅 @ 提醒、通知中心、提及收件箱、桌面系统通知细分策略。
5. 成员运营缺口：缺新成员 onboarding、欢迎页、规则确认、邀请链接、成员标签、活跃/在线状态。
6. 治理与安全缺口：缺 AutoMod、关键词/垃圾消息过滤、慢速模式、举报队列、封禁/踢人审计、管理员操作日志。
7. 平台生态缺口：已有插件基座，但缺机器人、命令、webhook、频道事件扩展、插件市场推荐、插件能力与社群权限联动。

下一阶段不应优先追私聊或全量音视频，而应先补频道社群运营能力。

## 优先级

### P0：补到可日常使用

P0 目标是让中小社群可以长期使用频道聊天，而不是只跑通演示链路。

1. 消息搜索：支持当前频道搜索、关键词结果、点击跳转消息上下文。
2. @提及与提及收件箱：支持用户提及、提及未读、集中入口和点击跳转。
3. 消息编辑、置顶、真正转发：补齐消息管理高频动作，替换当前 forward 复用 copy 的占位行为。
4. 频道分类与排序：把平铺频道变成可分组结构，接入真实远端 discover。
5. 通知策略：支持服务器默认、频道覆盖、静音、仅提及提醒。
6. 审计日志基础版：记录高风险治理动作，支持管理员追溯。

### P1：形成社群运营能力

1. 身份组与频道级权限。
2. 公告频道。
3. 线程/帖子型讨论。
4. 成员 onboarding。
5. AutoMod 基础版。
6. 邀请链接与成员来源追踪。

### P2：平台化与生态增强

1. 机器人、斜杠命令、webhook。
2. 活动、日程、舞台、语音频道。
3. 高级搜索：跨频道、按发送者、按时间、按附件/domain。
4. 收藏、稍后看、个人笔记。
5. 多端强一致：草稿、已读、通知偏好、收藏同步。
6. 插件市场推荐、评分、权限审核、自动更新策略。

## P0 能力设计

### 消息搜索

缺陷：当前只有频道列表搜索，没有消息搜索。历史消息积累后，用户无法找回内容。

建议：

1. 先做频道内搜索。
2. 入口放在 ChatCenter 顶部。
3. 搜索结果按时间倒序展示。
4. 点击结果后选择目标频道、加载目标消息附近上下文、滚动并短暂高亮。
5. 后续扩展跨频道搜索、按用户/domain/附件筛选。

协议建议：

`GET /api/channels/{cid}/messages/search?q=&cursor=&limit=`

### @提及与提及收件箱

缺陷：当前消息是纯 draft + domain payload，没有提及解析、提及未读、集中入口。

建议：

1. Core:Text 先支持用户提及。
2. 客户端可做输入提示和局部渲染，但服务端必须负责规范化 uid 列表。
3. 发送请求携带 `mentions` 字段。
4. 服务端产生 mention unread，并通过事件通知目标用户。
5. 客户端提供提及收件箱，展示“谁在什么频道提到了我”，点击后跳转目标消息。
6. 协议预留 `mention_type`，后续支持用户、身份组、全体成员。

### 消息编辑、置顶、真正转发

缺陷：已有删除/回复，但消息不能编辑或置顶，转发只是复制文本。

建议：

1. 编辑：先限制为发送者编辑 Core:Text；消息模型增加 `edited_at`。
2. 置顶：频道维度维护 pinned messages；入口放在消息菜单和频道设置菜单。
3. 转发：提供选择目标频道流程；服务端生成一条引用原消息摘要的新消息，而不是简单复制文本。
4. 写操作都返回显式 Outcome，延续当前 message-flow/room-governance 风格。

### 频道分类与远端 discover

缺陷：频道列表平铺，discover 目前更像本地状态过滤，缺少真实未加入频道发现。

建议：

1. 频道模型增加 `category_id`、`order`、`type`。
2. 左侧频道栏按分类折叠展示。
3. 默认分类可使用 Text Channels、Announcements、Management。
4. P0 先做服务端排序和只读分类展示；拖拽排序留到 P1。
5. discover 接入远端搜索，避免未加入频道搜索长期停留在占位状态。

协议建议：

1. `GET /api/channels/discover?q=`
2. channel record 增加 `category_id/order/type`

### 通知策略

缺陷：已有未读和托盘闪烁基础，但缺少服务器/频道级通知偏好，用户不能控制提醒噪音。

建议：

1. 通知偏好模型包含 server default、channel override、muted、mentions_only。
2. 客户端根据事件和偏好决定托盘闪烁、系统通知、未读计数。
3. P0 可以先做本地持久化。
4. 后续如需要多端同步，再提升为服务端 API。

### 审计日志基础版

缺陷：治理功能已有，但管理员操作缺少可追溯记录。

建议：

1. 服务端提供频道/服务器审计事件列表。
2. 客户端在治理入口增加 Audit 页面。
3. P0 只记录高风险动作：创建/删除频道、踢人、禁言/解除、管理员变更、消息删除、频道资料修改。
4. 审计日志只读展示，不进入普通消息流。

协议建议：

`GET /api/audit_logs`

## 架构落点

P0 能力不应全部塞进 `message-flow`。推荐沿用现有 `chat` 三子域，并新增两个轻量子域。

### message-flow

负责消息本体能力：

1. 搜索结果到消息投影的映射。
2. 消息编辑。
3. 置顶和转发的消息菜单入口。
4. 转发 payload 构造。
5. mention 文本渲染。

不负责通知偏好和审计日志。

### room-session

负责频道目录与当前频道上下文：

1. 频道分类展示。
2. 远端 discover。
3. 选择频道。
4. 跳转到目标消息附近上下文。

搜索结果、mention、置顶点击都应复用同一类跳转流程：选择目标频道，加载目标消息窗口，滚动并高亮。

### room-governance

负责治理动作与入口：

1. 频道治理入口。
2. 置顶列表管理入口。
3. 分类管理动作。
4. 审计日志入口。

审计日志本身不应继续塞进 governance service，避免治理服务膨胀。

### chat/notifications

候选新增子域，负责：

1. 服务器/频道通知偏好。
2. 提及收件箱。
3. mention unread。
4. 桌面通知和托盘策略适配。

它依赖 session 当前服务器上下文和事件流，但不直接修改消息时间线。

### chat/audit-log

候选新增子域，负责：

1. 审计事件查询。
2. 筛选。
3. 只读列表和详情展示。

它消费服务端 API，不反向依赖治理页面内部状态。

## 协议与事件扩展

建议新增或扩展 HTTP：

1. `GET /api/channels/{cid}/messages/search`
2. `PATCH /api/messages/{mid}`
3. `POST /api/channels/{cid}/pins/{mid}`
4. `DELETE /api/channels/{cid}/pins/{mid}`
5. `GET /api/channels/{cid}/pins`
6. `POST /api/messages/{mid}/forward`
7. `GET /api/mentions`
8. `PUT /api/channels/{cid}/notification_preference`
9. `GET /api/audit_logs`
10. `GET /api/channels/discover?q=`

建议新增或扩展 WS 事件：

1. `message.updated`
2. `message.pinned`
3. `message.unpinned`
4. `mention.created`
5. `audit_log.created`
6. `channel.category_changed`

WS 事件只作为增量刷新和实时提示。关键状态必须能通过 HTTP 重新拉取恢复。

## 页面落点

1. ChatCenter 顶部增加搜索入口和置顶入口。
2. 消息菜单扩展 edit、pin、forward。
3. ChannelRail 增加分类分组、折叠状态、远端 discover 状态。
4. MembersRail 暂不扩展，避免右栏变重。
5. ChannelSettingsMenu 增加 pins、audit、notification preferences 入口。
6. Mention Inbox 可先放在 QuickSwitcher 或左侧顶部，作为轻入口，不做复杂独立页面。

## 错误处理与恢复

新增能力继续使用显式 Outcome，不把业务失败藏在异常字符串里。

建议错误码覆盖：

1. 搜索失败。
2. 目标消息不存在或不可访问。
3. 消息不可编辑。
4. 消息编辑失败。
5. 置顶失败。
6. 转发失败。
7. 提及列表拉取失败。
8. 通知偏好保存失败。
9. 审计日志拉取失败。
10. 远端 discover 失败。

恢复策略：

1. 搜索、mentions、pins、audit logs 都必须支持 HTTP 重拉。
2. WS 断线恢复失败时，session catch-up 后应刷新 mentions 和 pins 摘要。
3. 通知偏好本地持久化失败时，UI 应保留原偏好并展示错误。

## 验收口径

这份 spec 的验收不是“所有功能都实现”，而是清楚回答：

1. CarryPigeon 当前作为频道社群型 IM 缺哪些关键能力。
2. 哪些能力属于 P0/P1/P2。
3. P0 能力应放在哪个 chat 子域或新增子域。
4. 哪些能力必须扩协议/服务端，哪些客户端可先做壳或本地实现。
5. 后续实现不会把 ChatCenter、message-flow 或 runtime store 重新堆成大杂烩。

## 相关链接

1. `docs/design/PRD.md`
2. `docs/api/11-http-endpoints-v1.md`
3. `docs/api/12-ws-events-v1.md`
4. `src/features/chat/README.md`
5. `src/features/chat/message-flow/README.md`
6. `src/features/chat/room-session/README.md`
7. `src/features/chat/room-governance/README.md`
8. Discord Roles and Permissions: https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions
9. Discord Threads FAQ: https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ
10. Discord Forum Channels FAQ: https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ
11. Discord AutoMod FAQ: https://support.discord.com/hc/en-us/articles/4421269296535-AutoMod-FAQ
12. QQ 机器人官方文档: https://bot.q.qq.com/wiki/
