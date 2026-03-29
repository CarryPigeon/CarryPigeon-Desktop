# 各 Feature 深度审查与可读性优化方案

## 审查方式
- 采用 6 个智能体并行深审：
- `Rust(features/shared)`、`account+settings`、`chat`、`plugins`、`server-connection`、`app+shared(frontend)`。
- 本文只保留会显著影响“新开发者一眼读懂”的问题与优化方案。

## 已完成的注释/文档完善（本轮落地）
1. 修复并统一 plugins 文档边界，明确跨 feature 仅经 `api.ts`。
2. 修正 plugins API 注释术语（从“只读视图”改为“状态只读 + 命令方法”）。
3. 修正 `domainRegistryStore` 误导注释（`cid` 来源改为 `hostBridge.getCid()`）。
4. 更新 `settings/README`，明确 `ClearServerScopeUseCase` 的跨域编排职责。
5. 更新 `ServerInfoPort` 注释，改为真实链路（`/api/server`）。
6. 更新 chat 子域 README（room-session/message-flow/room-governance）到当前文件结构。
7. 补充 chat 顶层 README 的事件流主链说明。
8. 更新 shared provider 注释，强调 runtime bootstrap 显式注册。
9. 改善 `subWindowRouting` 可读性并修复未知子窗口误判。
10. 改善 `userProfileBridge` 分支可读性并补未知 action 兜底响应。

## 分 Feature 深审结论与优化方案

### 1) account
- 主要问题（medium）：`useLoginConnection` 与 `useRequiredSetupModel` 职责过载（状态 + 启动副作用 + 路由/重检混合）。
- 优化方案：
1. 新增 `auth-flow/application` 编排层（`loginBootstrapUseCase` / `requiredGateRecheckUseCase`）。
2. composable 只保留页面状态与显式命令，`onMounted` 启动链迁出。
3. 将 `transport` 明确为“UI only”或接入连接参数（二选一，不保留灰态）。

### 2) settings
- 主要问题（medium）：`useSettingsPageModel` 同时承载主题与破坏性清理流程，语义跨度大。
- 优化方案：
1. 拆分 `useThemeSettingsModel` 与 `useClearServerScopeModel`。
2. 统一 DI 约定（同一 feature 内 usecase 构造策略一致）。
3. logger 名称改为层级语义一致（如 `settings.clearServerScope`）。

### 3) chat
- 主要问题（high/medium）：
- `MainPage.vue` 超聚合，难以一眼定位责任。
- 事件流分散，缺少统一“路由/状态落点”心智入口。
- `as unknown as` 与 `unknown` 强转使边界契约不透明。
- 优化方案：
1. 将 `MainPage.vue` 再拆 3~4 个 orchestration composable。
2. 定义“事件总线主链文档 + 代码注释锚点”（ws -> eventRouter -> subdomain）。
3. 移除双重类型断言，统一复用 `chatWireDtos` 类型源。
4. 拆分 `messageActionError` 为结构化错误（按动作维度）。

### 4) plugins
- 主要问题（medium）：
- 文档与真实调用链曾有漂移（已部分修复）。
- `pluginInstallStore` / `domainRegistryStore` 文件职责仍偏厚。
- runtime 模型命名 `snake_case/camelCase` 混用认知成本高。
- 优化方案：
1. `pluginInstallStore` 拆为 `state/progress`、`lifecycle-actions`、`required-gate`。
2. `domainRegistryStore` 拆为 `loader`、`registry`、`host-bridge` 协作者。
3. 显式区分 `Raw*` 与 `Normalized*` 类型层。
4. 继续强化边界检查脚本（已接入 lint）。

### 5) server-connection
- 主要问题（high/medium）：
- 连接状态机对旧事件覆盖新状态的防护不足（缺 generation token）。
- `TcpService` 职责过密。
- 优化方案：
1. 在连接状态事件中引入 `generation/session token`，防旧事件覆盖。
2. `TcpService` 拆为 `HandshakeCoordinator`、`ResponseCallbackRegistry`、`FrameRouter`。
3. 根 API 继续收敛为聚合 start/stop，不对外泄漏子 runtime 控制。

### 6) app + shared（frontend）
- 主要问题（high/medium）：
- `startupSession.tryRestoreSession` 仍为多职责聚合函数。
- `httpJsonClient` 传输分支过长，阅读切换成本高。
- 优化方案：
1. `tryRestoreSession` 拆成 phase 函数（connect/requiredGate/authRestore/redirect）。
2. `httpJsonClient` 拆 transport adapter（mock/tauri/fetch）。
3. provider 回退路径补结构化 warn（可选但建议）。

### 7) Rust features/shared
- 主要问题（high/medium）：
- `plugins` 与 `settings` 大文件职责厚。
- `shared/db` 仍有分层方向风险（shared 依赖 feature 配置）。
- 优化方案：
1. `plugin_store.rs` 继续拆 facade + service 子模块。
2. `config_store.rs` 拆 schema/io/compat 层。
3. 把 DB 参数改为启动注入，消除 shared -> features 依赖。
4. 统一 TLS 客户端策略实现，减少跨 feature 重复逻辑。

## 推荐执行顺序（两周内）
1. 第 1 优先级：`chat MainPage` 拆分 + `server-connection generation token`。
2. 第 2 优先级：`plugins install/registry` store 拆分。
3. 第 3 优先级：`startupSession/httpJsonClient` phase/adapter 拆分。
4. 第 4 优先级：Rust `plugin_store/config_store/shared-db` 结构收敛。

## 验收标准
1. 新人可在 30 分钟内说清每个 feature 的入口、状态源与副作用路径。
2. 关键路径文件长度下降，单文件职责单一（避免 600+ 行聚合文件）。
3. 事件流与跨 feature 边界有明确注释锚点与 lint 约束。
