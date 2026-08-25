# 任务单：接线服务端已有、产品路径未实现的 HTTP API

任务名称：wire-unwired-apis

状态：done

任务目标：
把服务端已暴露、客户端 adapter 已写、但产品路径点不到的 5 条 HTTP 接到真实 UI：

- GET `/api/channels/discover`
- GET `/api/audit_logs`
- GET `/api/mentions`
- PUT `/api/mentions/{id}/read`
- PUT `/api/mentions/read_state`

任务背景：
`ai-agent-workplace/server-api-client-gap.md` §0 将这 5 条标为「adapter 有、产品路径没接上」。本任务只接线，不改服务端协议。

影响模块：
- `src/features/chat/channel-discovery/`
- `src/features/chat/mention-inbox/`（新建）
- `src/features/chat/audit-logs/`
- `src/features/chat/presentation/patchbay/`
- `src/features/chat/public/routes.ts`、`src/app/router.ts`、i18n
- `src/features/chat/composition/createChatEventRouter.ts`

允许修改范围：
- 仅客户端 `carrypigeon-desktop`
- 上述 chat 子域、主页面菜单/路由、中文/英文文案、对应 vitest

禁止修改范围：
- 任何 `carrypigeon-server` 文件
- 客户端多余且真服 404 的 reactions / files list-delete
- 服务端未暴露 HTTP 的能力：用户关键字搜索、邀请、转让群主、mute、频道公告、独立私聊 `POST /channels/private`
- 提及点击主路径不得走 `around_mid`（服务端 SQL 500）
- 不改计划文件

依赖限制：不新增 npm/Cargo 依赖。

配置限制：不新增占位配置。

文档依据：
- `src/features/AGENTS.md`、`src/features/chat/README.md`
- `docs/Feature模块设计规范.md`
- 服务端 Controller/DTO 为协议真源

验收标准：
1. Discover Tab 切换或搜索会打 `GET /api/channels/discover`，已加入频道不出现在发现列表，申请加入走现有 `applyJoin`
2. 聊天顶栏提及铃拉取 `GET /api/mentions`，单项已读与全部已读打对应 PUT；`mention.created` 会刷新收件箱；点击进入频道且不请求 `around_mid`
3. 频道设置菜单可打开审计日志页，按当前 `cid` 打 `GET /api/audit_logs`
4. 子域 `api.ts` 不泄漏 wire DTO
5. 相关 vitest 与 `pnpm run typecheck` 通过

完成定义：
产品路径可点到这 5 条 HTTP；任务单改为 `done`；已提交并开 PR。

## 实际结果

PR：https://github.com/ShirasawaTopaz/CarryPigeon-Desktop/pull/2
分支：`cursor/wire-discover-mentions-audit-5d41`
实现提交：`8037242` `feat(chat): wire discover, mentions inbox, and audit logs`

### 产品入口

1. Discover：频道栏「未加入频道」Tab；搜索框 placeholder「搜索公开频道」；debounce 后 `q=`；行内「申请加入」走现有 `applyJoin`。
2. Mentions：聊天顶栏铃铛打开「提及」面板；`mention.created` 刷新收件箱；点击项只 `selectChannel`，不请求 `around_mid`。
3. Audit logs：频道设置菜单「审计日志」→ `/channel-audit-logs?id=&name=`，按 `cid` 拉日志。

### 验证记录

自动化：
- `pnpm run typecheck` 通过
- 相关 vitest（discover / mentions / audit mapper+service+HTTP、event router、i18n localeKeys）通过
- `scripts/check-feature-boundaries.sh` 通过

真服浏览器（账号 `ui_alice_0825`，服务器 `http://127.0.0.1:8080`）：

- `GET /api/channels/discover?limit=20`
- `GET /api/channels/discover?q=room2&limit=20`
- `GET /api/mentions?limit=50` 与 `unread_only=true`
- `GET /api/audit_logs?limit=50&cid=1`

UI：发现列表含未加入公开房间 +「申请加入」；搜索 `room2` 过滤正确；提及面板空态「暂无提及」；审计页空态「审计日志 (0) / 暂无审计日志」。

### 未覆盖 / 残留风险

- 未在 UI 上点「申请加入」做端到端成员变更（仍走原 governance）。
- 当前账号提及收件箱为空，未用真实 mention 点单项/全部已读；PUT 路径由 usecase 单测覆盖。
- `pnpm run lint` 全量（含 rust）未跑。
- 服务端仓未改。
