# plugins（插件体系）

## 定位

`plugins` 负责客户端侧插件全链路：目录拉取、安装/启停/切换版本、运行时动态加载、以及 domain renderer/composer 注册。

## 边界

做什么：

- 插件目录（server catalog + repo catalog）聚合。
- 插件生命周期命令（安装、启用、禁用、切换、卸载、回滚）。
- 插件运行时加载与 host API（storage/network）注入。
- domain registry 维护（供 `chat` 消费）。

不做什么：

- 不负责聊天 UI 渲染流程（`chat` 负责）。
- 不负责 server socket/TLS 选择（`server-connection` 负责）。

## 跨 Feature 入口（强约束）

- **跨 feature 只允许通过** `@/features/plugins/api`。
- 跨 feature 类型约束只允许通过 `@/features/plugins/api-types`。
- `@/features/plugins/api` 主入口为 `createPluginsCapabilities()` / `getPluginsCapabilities()` 返回的能力对象。
- `plugins/internal/repoSourcesAccess.ts`、`plugins/internal/workspaceAccess.ts`、`plugins/internal/runtimeAccess.ts` 仅作为根入口的内部访问层，不应被跨 feature 直接引用。
- `presentation/*`、`di/*`、`data/*`、`mock/*` 与 `domain/ports/*` 视为 feature 内部实现，不作为跨 feature 入口。
- 跨 feature 不应依赖 Vue `Ref/ComputedRef` 形状；需要响应式适配时，应在消费方 feature 自己的 integration/composable 中完成。

## 目录结构

- `api.ts`：稳定公共能力入口（`create/getPluginsCapabilities`）。
- `api-types.ts`：稳定公共类型入口。
- `contracts/`：跨层共享但不等于“公共入口”的内部稳定契约。
- `domain/`：领域模型、ports、usecases。
- `data/`：HTTP/Tauri 适配器。
- `di/`：依赖装配（mock/live）。
- `presentation/`：页面、组件、store、runtime。
- `mock/`：本地 mock。

根入口拆分（内部实现）：

- `internal/repoSourcesAccess.ts`：repo source 管理访问层。
- `internal/workspaceAccess.ts`：catalog / installed state 工作区访问层。
- `internal/runtimeAccess.ts`：runtime view、host bridge 与 domain 查询访问层。

## 运行时分层（当前）

- `presentation/runtime/runtimeGateway.ts`：Tauri 命令调用。
- `presentation/runtime/hostApiFactory.ts`：受控 host API 构造。
- `presentation/runtime/moduleNormalizers.ts`：Raw DTO -> Model 规范化。
- `presentation/runtime/pluginRuntime.ts`：运行时编排与模块加载。

## 关键流程

### 目录刷新

1. `usePluginCatalogStore(serverSocket).refresh()` 拉取 server catalog。
2. 从启用的 repo source 列表拉取 repo catalog（可选）。
3. 合并、去重、排序后写入 catalog store。

### 生命周期命令

1. UI 通过 `pluginInstallStore` 触发动作（install/updateToLatest/enable/disable/switchVersion/uninstall/rollback）。
2. `install` 走 `commandPort.install/installFromUrl`；其余生命周期动作通过应用层编排 `ApplyPluginRuntimeOps`。
3. 命令执行后刷新 installed state，并通知 runtime/registry 同步。

### 安装态动作分层速查

| 分层 | 文件 | 主要职责 |
| --- | --- | --- |
| 动作集合 | `presentation/store/pluginInstallActions.ts` | 聚合 install/update 与 lifecycle 两组动作，对 store 暴露稳定动作接口 |
| 安装更新动作 | `presentation/store/pluginInstallInstallUpdateActions.ts` | `install` / `updateToLatest`，处理目录版本解析与下载来源 |
| 生命周期动作 | `presentation/store/pluginInstallLifecycleActions.ts` | `switchVersion` / `rollback` / `enable` / `disable` / `uninstall` |
| 通用执行器 | `presentation/store/pluginInstallOperationHelpers.ts` | busy gate、进度回调、失败回填、统一操作包装 |
| 操作常量 | `presentation/store/pluginInstallOperations.ts` | 安装态动作常量与联合类型（单一字面量来源） |
| 读模型与 required | `presentation/store/pluginInstallSelectors.ts` | `isInstalled/isEnabled/isFailed` 与 required 缺失重检 |
| 共享类型 | `presentation/store/pluginInstallActionTypes.ts` | actions deps 与动作集合类型 |

### runtime 装载

1. `domainRegistryStore.ensureLoaded()` 读取已安装且启用的插件。
2. 通过 runtime gateway 获取 entry 信息。
3. 动态 import `app://plugins/...` 模块并规范化导出。
4. 注册 domains（renderer/composer/contract）供 chat 消费。

## 主要文件

- API：`src/features/plugins/api.ts`
- 公共类型：`src/features/plugins/api-types.ts`
- 工作区控制器：`src/features/plugins/internal/workspaceAccess.ts`
- 目录 store：`src/features/plugins/presentation/store/pluginCatalogStore.ts`
- 安装态 store：`src/features/plugins/presentation/store/pluginInstallStore.ts`
  - 操作编排 helper：`src/features/plugins/presentation/store/pluginInstallOperationHelpers.ts`
  - 动作集合（聚合 install/update + lifecycle）：`src/features/plugins/presentation/store/pluginInstallActions.ts`
  - install/update 动作：`src/features/plugins/presentation/store/pluginInstallInstallUpdateActions.ts`
  - lifecycle 动作（switch/rollback/enable/disable/uninstall）：`src/features/plugins/presentation/store/pluginInstallLifecycleActions.ts`
  - 动作共享类型：`src/features/plugins/presentation/store/pluginInstallActionTypes.ts`
  - 操作常量：`src/features/plugins/presentation/store/pluginInstallOperations.ts`
  - 安装态 selectors：`src/features/plugins/presentation/store/pluginInstallSelectors.ts`
- 注册表 store：`src/features/plugins/presentation/store/domainRegistryStore.ts`
- 运行时编排：`src/features/plugins/presentation/runtime/pluginRuntime.ts`

## 公共 API 设计约定

- `api.ts` 采用 object-capability：通过 `createPluginsCapabilities()` 组装最小公共能力面；`getPluginsCapabilities()` 用于可选的应用级访问器。
- `api-types.ts` 只保留跨 feature 真正需要直接引用的稳定类型与 `PluginsCapabilities` 契约；控制器与快照等辅助类型优先从 capability 契约局部推导，而不是继续增加新的根公共类型名。
- 工作区能力统一从 `capabilities.workspace.createCapabilities()` 获取；返回的是 plain capability，若消费方需要 `computed`/`watch`，应在自身 feature 内部做本地响应式适配。
- server-scoped 能力统一通过 `capabilities.forServer(serverSocket)` 绑定上下文，避免在根公开面重复透传 `serverSocket`。
- 运行时采用 `capabilities.runtime.acquireLease()`，而不是根级 `startRuntime()`。
- 运行时只读查询统一使用 `capabilities.forServer(serverSocket).getRuntimeCapabilities()`，避免把普通查询函数命名成 Vue composable。

## 相关文档

- `docs/design/client/PLUGIN-INSTALL-UPDATE.md`
- `docs/design/client/APP-URL-SPEC.md`
