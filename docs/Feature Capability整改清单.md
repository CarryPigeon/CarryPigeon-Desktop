# Feature Capability 整改清单

本文档记录本轮 capability 设计整改的明确问题、顺序和完成状态。

## 0. 严格数据流整改

本轮新增仓库级要求：

- [ ] `domain/ports` 不再直接公开 `*Dto` / transport payload。
- [ ] `application/usecase` 不再直接透传 data adapter 结果。
- [ ] `presentation` 不再直接消费 wire DTO。
- [ ] `api.ts` / `api-types.ts` 不再升级内部 DTO 为跨 feature 公共契约。

按 feature 的整改顺序：

- [x] DataFlow Step A：`account` 收敛 profile/auth 相关 DTO 与领域模型边界。
- [x] DataFlow Step B：`chat` 收敛 `chatApiPort`、wire DTO 与 presentation model 的边界。
- [x] DataFlow Step C：`plugins` 收敛 catalog/runtime/storage 相关 DTO、领域模型与 usecase 边界。
- [x] DataFlow Step D：`server-connection` 收敛 workspace/connectivity/rack 对 transport 细节的边界。
- [x] DataFlow Step E：`src-tauri` 对应 feature 的命令层 / usecase / data 层职责重新对齐。

## 1. 问题清单

- [x] 问题 1：子域 API 仍直接公开响应式状态。
  位置：
  `account/current-user`、`chat/room-session`、`chat/message-flow`、`chat/room-governance`
- [x] 问题 2：子域 API 仍直接公开 UI 组件。
  位置：
  `chat/message-flow/message`、`chat/message-flow/upload`
- [x] 问题 3：根 capability 仍存在过宽平铺公开面。
  位置：
  `account/api.ts`、`plugins/api.ts`
- [x] 问题 4：server 作用域没有被收敛成局部 capability。
  位置：
  `account/api.ts`、`plugins/api.ts`
- [x] 问题 5：错误语义仍通过错误类直接暴露。
  位置：
  `account/profile/api.ts`
- [x] 问题 6：feature 运行时只有启动入口，没有 ownership/lease。
  位置：
  `plugins/api.ts`、`server-connection/api.ts`
- [x] 问题 7：子域 `api.ts` 直接依赖 `presentation/store/*` 或 `data/*`，缺少 application/state facade。
  位置：
  `account/auth-flow`、`account/current-user`、`account/profile`、`chat/room-session`、`chat/message-flow`、`chat/message-flow/upload`、`chat/room-governance`、`server-connection/connectivity`、`server-connection/rack`、`server-connection/server-info`
- [x] 问题 8：`snake_case` runtime contract 被提升到 domain/public capability 边界。
  位置：
  `plugins/domain/types/pluginRuntimeTypes.ts`、`plugins/domain/types/pluginTypes.ts`、`plugins/api-types.ts`、`plugins/contracts/domainRegistry.ts`
- [x] 问题 9：根 capability 依赖的 internal/application 访问层仍直接包裹 presentation store。
  位置：
  `plugins/application/startPluginsRuntime.ts`、`plugins/application/stopPluginsRuntime.ts`、`plugins/internal/workspaceAccess.ts`、`plugins/internal/runtimeAccess.ts`
  当前约束：
  `plugins` 已补充 feature-state access contract，application 通过 `di` 获取 `*StateAccess`，不再直接拼接多个 store/runtime。

## 2. 整改顺序

- [x] Step 1：把上述问题固化进规范文档，形成仓库级禁止项。
- [x] Step 2：重构 `account/api.ts`，把 server 相关动作收敛到 `forServer(serverSocket)`。
- [x] Step 3：重构 `plugins/api.ts`，拆成 `workspace`、`runtime`、`forServer(serverSocket)` 三组能力。
- [x] Step 4：重构 `server-connection/api.ts`，把 `startRuntime()` 改成 lease 模式。
- [x] Step 5：重构 `account/current-user/api.ts`，删除响应式状态直接暴露。
- [x] Step 6：重构 `chat/room-session/api.ts`，改成 snapshot/observe + command。
- [x] Step 7：重构 `chat/message-flow/api.ts`，改成 timeline/composer 子 capability 的 snapshot/observe + command。
- [x] Step 8：重构 `chat/room-governance/api.ts`，成员列表改成 snapshot/observe。
- [x] Step 9：移除 `chat/message-flow/message` 与 `upload` 的组件公开。
- [x] Step 10：移除 `account/profile/api.ts` 中的错误类导出。
- [x] Step 11：更新所有消费方，确保没有旧式直接暴露残留。
- [x] Step 12：回跑 `npm run -s typecheck` 与反模式扫描，并把清单全部打勾。

## 3. 完成标准

全部整改完成时，应满足：

- [x] 没有 `api.ts` / `api-types.ts` 继续公开 Vue 响应式对象。
- [x] 没有 `api.ts` / `api-types.ts` 继续公开 UI 组件。
- [x] 根 capability 不再平铺 server-scoped 方法。
- [x] 根运行时统一采用 lease ownership。
- [x] 错误语义只通过谓词或格式化方法暴露。
- [x] `npm run -s typecheck` 通过。
- [x] 关键反模式扫描无命中。
