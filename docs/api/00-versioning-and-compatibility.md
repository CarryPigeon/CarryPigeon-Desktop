# 00｜API 版本与策略（v1 推荐）

版本：v1.0（draft）  
日期：2026-02-01  

## 1. 目标

本目录的目标是把 `docs/design/PRD.md` 中 P0 必须验收的语义稳定落到可实现的协议字段上，并给出“推荐对外协议”：

- 最新对外协议：HTTP + WebSocket，面向“标准化 + 灵活性优先”，不对既有 TCP/Netty 路由做向前兼容。

v1 重点语义包括：

- `server_id`：用于插件安装与缓存隔离（服务端必须稳定返回）
- `domain` + `domain_version`：用于插件消息契约校验与渲染选择
- `reply_to_mid`：回复关系（引用）
- required gate：required 插件未满足时 **阻止所有登录相关动作**，并返回可识别错误
- 插件目录：提供 `provides_domains` 映射用于未知 domain 的“一键安装提示”

## 2. API 版本策略（v1）

### 2.1 大版本（破坏性变更）

- 不使用 URL 路径版本（不采用 `/api/{version}/...` 形式）
- 使用 **Media Type Versioning** 区分大版本（推荐）：
  - `Accept: application/vnd.carrypigeon+json; version=1`
- 大版本之间允许破坏性变更（字段重命名、语义变化、删除端点）

补充（WebSocket）：
- 由于浏览器原生 WS 难以自定义请求 Header，WS 协议版本由客户端在 `auth.data.api_version` 显式声明（见 `docs/api/10-http-ws-protocol-v1.md`）。

### 2.2 小版本（同一大版本内）

- v1 内允许“只增不破坏”的演进：
  - 新增字段（客户端需忽略未知字段）
  - 新增可选端点
  - 新增 `capabilities` 标志位以便客户端按能力启用特性
- 禁止在 v1 内做破坏性变更：
  - 删除字段/改变字段类型
  - 改变已存在字段语义（尤其是 `server_id`、`domain_version`、required gate 行为）

## 3. 路由与资源命名（v1 标准化）

v1 使用“资源化”命名，避免将内部实现（Core/Service 等）暴露为外部 contract：

- `GET /api/server`
- `POST /api/auth/tokens`
- `GET /api/channels`
- `POST /api/channels/{cid}/messages`
- `GET /api/plugins/catalog`

具体端点见：
- `docs/api/11-http-endpoints-v1.md`
- `docs/api/12-ws-events-v1.md`

## 4. snake_case 与时间口径（v1 必须）

为避免多语言 SDK 兼容问题：

- 所有字段必须为 `snake_case`
- 所有时间字段必须为 Unix epoch 毫秒

## 5. required gate（v1 必须）

v1 把 required gate 定义为“认证前置条件”，因此推荐：

- 阻断点：`POST /api/auth/tokens`（创建会话/签发 token）
- 返回：`412 Precondition Failed` + `error.reason="required_plugin_missing"` + `details.missing_plugins[]`
- 客户端需先 `GET /api/server`、`GET /api/plugins/catalog` 并完成插件安装后再登录

## 6. 相关文档

- `docs/design/PRD.md`
- `docs/design/protocol/PROTOCOL-OVERVIEW.md`
- `docs/design/protocol/MESSAGE-DOMAINS.md`
- `docs/design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`
- `docs/客户端开发指南.md`
- `docs/api/10-http-ws-protocol-v1.md`
- `docs/api/11-http-endpoints-v1.md`
- `docs/api/12-ws-events-v1.md`
- `docs/api/13-error-model-and-reasons-v1.md`
- `docs/api/14-pagination-and-cursor-v1.md`
