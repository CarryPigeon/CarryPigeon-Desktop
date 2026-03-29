# `src/features` 结构说明（精简版）

## 1. 总体原则

- 采用 Feature-first 组织：每个功能模块自包含。
- 跨 Feature 协作优先通过 `@/features/<feature>/public/api` 暴露能力。
- `app/router` 优先通过 `@/features/<feature>/public/routes` 装配页面入口。
- 若某 feature 暂未提供 `public/api.ts`，视为“暂无稳定跨 feature 公共接口”，不应直接依赖其内部路径。
- `app/` 作为 composition root，若确需消费 feature 级公共资源（例如全局样式），也必须通过显式公共入口（例如 `@/features/<feature>/public/styles`），不能直连 `presentation/*`。
- 不保留旧路径兼容，避免隐式耦合。

## 2. 目录职责

每个 feature 按需包含：

- `domain/`：模型、ports、usecases
- `public/`：对 app / 其他 feature 公开的稳定边界
- `composition/`：feature 级 composition root
- `application/`：feature 或子域内部编排与稳定服务入口
- `adapters/`：外部协议与依赖适配器实现
- `presentation/`：页面、组件、store
- `mock/`、`test/`：按需

约束：`presentation -> composition -> domain <- adapters`

## 3. Mock 模式

真源：`src/shared/config/runtime.ts`

- `off`：真实链路
- `store`：feature 内存 mock
- `protocol`：协议 mock transport（HTTP/WS）

统一选择器：`src/shared/config/mockModeSelector.ts`

补充：`protocol` 下插件 runtime 动态加载默认禁用。

## 4. 各 Feature 快速入口

- `account`：`src/features/account/api.ts` + `src/features/account/api-types.ts`（说明：`src/features/account/README.md`）
- `chat`：`src/features/chat/public/api.ts`（能力） + `src/features/chat/public/api-types.ts`（公共类型；聚合 room-session/message-flow/room-governance 子域，说明：`src/features/chat/README.md`）
- `plugins`：`src/features/plugins/api.ts`（能力） + `src/features/plugins/api-types.ts`（公共类型），说明：`src/features/plugins/README.md`
- `server-connection`：`src/features/server-connection/api.ts`（类型：`src/features/server-connection/api-types.ts`，说明：`src/features/server-connection/README.md`）
- `settings`：`src/features/settings/api.ts`（能力） + `src/features/settings/api-types.ts`（公共类型；本地设置读取/主题更新，说明：`src/features/settings/README.md`）
- 路由入口：如存在页面级公共入口，则通过 `src/features/<feature>/public/routes.ts`
- `chat` 样式入口：`src/features/chat/public/styles.ts`（仅供 `app/` 层挂载全局样式）
- 文件传输基础能力：`src/shared/file-transfer/README.md`
- 平台能力：`src/shared/platform/README.md`

## 5. 常见跨模块调用（示例）

- 插件安装态查询：`getPluginsCapabilities().forServer(serverSocket).listInstalledPlugins()`
- 连接当前 server workspace：`getServerConnectionCapabilities().workspace.connect()`
- 服务器工作区快照：`getServerConnectionCapabilities().workspace.getSnapshot()` / `observeSnapshot(...)`

## 6. 深入文档

- 架构总览：`docs/架构设计.md`
- Feature 设计规范：`docs/Feature模块设计规范.md`
- 接入清单：`docs/新Feature接入检查清单.md`
- Mock 联调：`docs/前端调试与Mock.md`
