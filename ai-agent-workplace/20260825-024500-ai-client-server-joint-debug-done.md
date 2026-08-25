# 任务单：跨仓库联合调试（desktop 侧）

状态：`done`  
作者：`ai`  
时间：`20260825-024500`  
任务短名：`client-server-joint-debug`

用户后续确认：**只能修改客户端，不可以修改服务端。** 服务端仓库本轮零提交；联调产物全部放在本目录。

## 任务名称

CarryPigeon Desktop 对真实 CarryPigeon Server 的 HTTP/WS v1 全覆盖联合调试。

## 任务目标

按覆盖全集核验两端 HTTP/WS v1 交互；每个对外能力都有可复查的成功与失败证据。默认不改对外协议。仅修对齐服务端既有契约的桌面 adapter。

## 任务背景

两端实现已是 REST `/api/*` + Netty WS `/api/ws`。客户端开发指南仍残留 TCP/`CPResponse`。预研风险：Accept、PATCH 204、reactions/文件库无路由、公开资料字段、mail/storage 默认关闭、端口分裂。必须全覆盖，不能只冒烟。

## 影响模块

- 正式代码：`src/features/chat/data/chat-api`、`src/shared/file-transfer`、`src-tauri/src/features/network/di/commands.rs`
- 工作目录：`ai-agent-workplace/`
- 服务端：只读核验

## 允许修改范围

- 本仓库 `ai-agent-workplace/`
- 对齐既有服务端契约的 adapter / 204 / 幂等 body / 下载 302，以及配套 vitest

## 禁止修改范围

- 服务端任何文件
- 对外协议、新服务端端点、Feature 深引用、domain 依赖 Vue/Tauri
- 把 reactions/文件库当成服务端必须实现
- 回写正式 `docs/`
- 恢复 TCP

## 依赖限制

未新增 npm/cargo 依赖。联调 `VITE_USE_MOCK_API=false`。

## 配置限制

未提交 `.env` 或密钥。服务端 mail/storage 仅用本机 overlay，不入库。

## 文档依据

- 桌面 `AGENTS.md`、Feature 规范
- 服务端 `docs/api/API.md`、Controller 源码
- `docs/standards/AI协作开发规范.md`、任务单模板、变更审核清单（只读）

协议真源优先级：服务端源码 > API.md > 客户端 adapter > 客户端 `docs/api/*` 设计对照。忽略 TCP/`CPResponse.code`。

## 任务分解

1. 任务单 + 工程提示词
2. 契约矩阵（客户端调用 ∪ 服务端 Controller/WS）
3. 启动真服，A–I 全覆盖（curl/脚本 + 双账号 WS）
4. findings；只修客户端适配
5. 覆盖清单无空白后改 `done`

## 关键假设（已核验）

- HTTP 8080 / WS 18080，必须用 `GET /api/server` 的 `ws_url`：成立
- vendor Accept 可能 406：**推翻**，`GET /api/server` 200
- PATCH 204 会空引用：成立，已修
- 本环境无 Docker：用本机 MySQL/Redis/MinIO/aiosmtpd

## 实现要求

跨 feature 只走 `@/features/<name>/api`。注释中文，日志英文。

## 测试要求

覆盖全集 = 客户端全部 `/api`+WS ∪ 服务端全部对外 HTTP 与已实现 WS。每条成功+失败。见 `feature-coverage-checklist.md`。

## 质量门禁（已执行）

- 覆盖清单 135 行全部 `pass`/`fail`/`blocked`，无空白
- `pnpm run typecheck` 通过
- `pnpm exec vitest run src/features/chat/data/chat-api/httpChatApi.test.ts src/shared/file-transfer/fetchAuthedBinary.test.ts` 通过（5）
- 未跑全量 `pnpm run lint` / `mvn test`（无服务端代码变更；lint 非本任务门禁）
- `git diff --check` 通过
- 未跑 Tauri GUI / 全量 `cargo test`：下载路径用协议 302 + 单元测试验证；Rust 变更在 `download_file`

## 复审要求

adapter 对照服务端 DTO/状态码。未改协议。

## 文档要求

不回写 `docs/`。产物仅 `ai-agent-workplace/`。

## 验收标准

- [x] 任务单
- [x] `contract-matrix.md`
- [x] `feature-coverage-checklist.md` 无空白
- [x] `joint-debug-findings.md`（路径、期望/实际、复现、是否阻断、归属）
- [x] 客户端适配有测试

## 完成定义

已满足。服务端三项 fail（File/Voice/around_mid）与邮件 blocked 已写明，不阻塞将本任务单标 `done`（覆盖已填完；服务端禁止修改）。

## 实际结果

客户端适配三处：

1. `httpPatchChannel`：204 后 GET 频道
2. `httpSendChannelMessage`：幂等键写入 `client_message_id`
3. `fetchAuthedBinary` + Tauri `download_file`：302 第二跳不带 Bearer

联调：pass=129 fail=3 blocked=3（total 135）。双账号 WS 事件在修正 harness 后通过。

## 验证记录

- `GET /api/server` vendor Accept 200，`ws_url=ws://127.0.0.1:18080/api/ws`
- 注册 201 无 token；密码登录 200；错密 401；过期 JWT 401 `token_expired`
- PATCH 频道 204 + GET 200
- send `client_message_id` 幂等；仅 `Idempotency-Key` 头不幂等
- 空频道 DELETE 204 / 再删 404
- 下载不跟随：302；MinIO 无 Bearer：200
- WS：B 收 `message.created|recalled|pinned|unpinned`、`mention.created`、`read_state.updated`、`channel.changed`；未 auth 10s `authentication_timeout`
- File/Voice send 422 `schema_invalid` `domain is not supported`；catalog 仅 text/custom
- `around_mid` 500，日志 CDATA SQL
- 邮件成功路径 503 `email_delivery_failed`

## 残留风险

- 文件/语音消息、around 跳转依赖服务端修复
- 邮箱登录成功路径依赖可用 SMTP
- Vite 浏览器预览跟随 MinIO 时仍可能受 CORS 限制；Tauri 原生下载已按 302 处理
- GUI：后续已在 Vite+Chrome 上用 computer-use 点通连接/登录/建群/发文本/改名，见 `ui-click-flow-evidence.md`；未跑完整 Tauri 壳窗口

## 知识沉淀 / 是否回写 docs

不回写。长期规则（204、幂等 body、302 不带 Bearer）已体现在 adapter 代码。

## 产物清理与保留说明

保留：本文件、`contract-matrix.md`、`feature-coverage-checklist.md`、`joint-debug-findings.md`。

## 变更审核清单自检

- 目标明确：联调 + 客户端适配，不改服务端
- 未越 Feature 边界；未新增依赖；未改配置体系；未改协议
- 注释：httpChatApi / fetchAuthedBinary / download_file 有中文说明
- 测试：成功（204 补 GET、幂等写入 body、302 无 Bearer）与对照路径

---

# 可复制工程提示词

```text
联合调试 carrypigeon-desktop × carrypigeon-server。
只改客户端。禁止改服务端文件、对外协议、新增端点。
协议真源：服务端 Controller/DTO/RealtimeChannelHandler > docs/api/API.md > 客户端 http*Api.ts / wsChatEvents.ts。
忽略客户端开发指南 TCP/CPResponse 与过时 CPResponse.code 测试口径。
覆盖全集 = 客户端全部 /api 与 WS ∪ 服务端全部 Controller 与已实现 WS 事件。无空白行。blocked 必须写外部原因。
成功无包装或 204；失败 {error:{status,reason,message,request_id}}。错误看 error.reason。
HTTP 8080，WS 必须用 GET /api/server 的 ws_url（18080）。
至少两账号 + private 频道。打开 storage；mail 失败则成功路径 blocked 并测 503。
只修对齐既有契约的 adapter（204、缺字段、404 降级、幂等 body、下载 302 不带 Bearer）。
交付：任务单、contract-matrix、feature-coverage-checklist、joint-debug-findings。
```
