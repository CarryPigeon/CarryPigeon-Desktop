# servers（服务器上下文）

## 定位

servers 负责“当前连接的是哪一台服务器”这一全局上下文：包括当前选中的 server socket、服务器机架（rack）列表、以及 per-server 的 TLS 配置与 server info 缓存。它是网络、认证、聊天、插件等 feature 的共同依赖。

## 职责边界

做什么：

- 维护当前 server socket（全局选择）。
- 维护 rack 列表（常用服务器列表），并提供 per-server 的 TLS 配置读取。
- 拉取并缓存 server info（例如 `server_id`），供插件隔离与 UI 提示使用。

不做什么：

- 不直接建立 TCP/TLS 连接（由 `network` feature 负责）。
- 不负责插件安装/启用（由 `plugins` feature 负责），但会提供 `server_id` 等必要信息。

## 关键概念

- **server socket**：用户输入/选择的服务端地址（可能包含多种前缀/协议形态，最终会被映射为 HTTP origin 或 TCP/TLS 连接参数）。
- **rack（机架）**：客户端侧保存的一条“服务器配置记录”（名称、socket、TLS 策略、备注等）。
- **TLS policy/fingerprint**：连接策略（严格/不安全/信任指纹），由 network 与 HTTP client 使用。
- **server info**：服务端基础信息（例如 `server_id`），用于插件隔离与功能门禁。

## 主要入口（导航）

- 当前 server：`src/features/servers/presentation/store/currentServer.ts`
- rack 列表与 TLS 配置：`src/features/servers/presentation/store/serverList.ts`
- server info 缓存：`src/features/servers/presentation/store/serverInfoStore.ts`
- 服务器管理页：`src/features/servers/presentation/pages/ServerManagerPage.vue`
- store 统一入口（跨 feature 推荐）：`src/features/servers/presentation/store/index.ts`
- rack 持久化端口：`src/features/servers/domain/ports/ServerRackStatePort.ts`
- rack 本地适配器：`src/features/servers/data/localServerRackStatePort.ts`

## 对外入口（推荐）

- servers 的 store 统一入口：`src/features/servers/presentation/store/index.ts`

## 关键流程（概览）

- 选择服务器：
  1) UI 调用 `setServerSocket(socket)`
  2) 其他 feature（chat/plugins/network）基于该值初始化各自的 per-server store 与连接
- 维护 rack：
  - `addServer` / `updateServerRack` 更新列表并持久化（当前主要基于 localStorage）

说明：

- rack 的持久化读写已通过 `ServerRackStatePort` 下沉到 data 层；
- presentation store 只负责状态组织与交互编排，不直接依赖 localStorage API。
- 获取 server info：
  1) `useServerInfoStore(socket).refresh()`
  2) 通过 `servers` 领域用例/port 拉取信息（HTTP 或 tauri 实现）
  3) 写入缓存供 UI 与插件体系使用

## 相关文档

- `docs/客户端开发指南.md`
- `docs/数据库使用指南.md`
