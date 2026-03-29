# Feature 设计审查最终结果（本轮）

## 结论
- 通过多轮“修正 -> 并行复审 -> 再修正”循环后：
- `plugins`、`server-connection`、`settings`、`rust network` 当前均为 **无 high/medium 结构问题**（多智能体并行复核）。

## 各 Feature 设计介绍

### 1) plugins
- 对外边界：统一经 `src/features/plugins/api.ts` 暴露。
- 运行时分层：
  - `runtimeGateway.ts`：Tauri 命令调用。
  - `hostApiFactory.ts`：受控 Host API 构造（storage/network）。
  - `pluginRuntime.ts`：模块加载与编排。
  - `moduleNormalizers.ts`：Raw DTO -> Model 规范化。
- 状态暴露：repo sources 改为 API 层只读快照，避免外部可变引用。
- 工程约束：新增 `scripts/check-feature-boundaries.sh`，并接入 `npm run lint`，限制跨 feature 只允许通过 `@/features/plugins/api`。

### 2) server-connection
- 顶层编排：`startServerConnectionRuntime()` 采用失败回滚（`Promise.allSettled`），避免部分启动成功导致脏状态。
- 运行时生命周期：
  - `connectivity` 增加 `stopConnectivityRuntime()`。
  - `rack` 增加 `stopServerRackRuntime()`。
  - `server-info` 增加 `stopServerInfoRuntime()`。
- `server-info` 对外改为查询/命令式 facade：`getServerInfoSnapshot/getServerInfoLoading/getServerInfoError/refreshServerInfo`，收敛 store 直接暴露。

### 3) settings
- 应用用例：`ClearServerScopeUseCase` 改为显式依赖注入（`refreshServerInfo` 必填）。
- DI 收口：由 `settings.di.ts` 统一提供 `getClearServerScopeUsecase()`。
- 页面编排：`useSettingsPageModel` 仅做 UI 组合，不再临时拼装跨 feature 依赖。

### 4) rust network（src-tauri）
- API 请求链路：`api_usecases` 仅依赖 `ApiRequestPort`；`http_client` 提供端口适配实现。
- TCP 链路：
  - 引入 `TcpBackendPort/TcpBackendFactoryPort`，real/mock 选择下沉 DI。
  - 移除 `listen_tcp_service` 命令，生命周期收敛为 `add/send/remove`。
  - `MockTcpMode::NoServer` 语义与实现对齐（send 返回错误）。
- 全局状态收敛：移除 `OnceLock` 全局注册表，改为 `TcpRegistryService` 注入到 Tauri state，由命令层显式依赖。

## 已执行校验
- `npm run -s typecheck`
- `cd src-tauri && cargo check -q`
- `bash scripts/check-rust-standards.sh`
- `bash scripts/check-feature-boundaries.sh`

以上校验在本轮修改后均通过。
