# plugins（插件体系）

## 定位

plugins 负责“插件能力”的客户端侧全链路落地：从服务端获取插件目录（catalog），到下载/校验/解压安装，再到启用/禁用/切换版本，以及运行时动态加载（`app://plugins/...`）并注册 domain renderer/composer。

## 职责边界

做什么：

- 插件生命周期：安装、卸载、启用、禁用、切换版本、回滚（对齐 UI 的操作集合）。
- 插件运行时：动态 import 插件模块，构建 host API（storage/network 等），并把插件提供的 domain 注册给宿主（chat）。
- 插件目录：从服务端与可选 repo 源拉取 catalog，并进行合并与排序。

不做什么：

- 不直接渲染聊天页面；插件只是提供 renderer/composer，具体渲染发生在 `chat`。
- 不管理 server socket 的选择与 TLS 配置（由 `servers` 负责），但插件数据/安装路径通常按 server scope 隔离。

## 关键概念

- **PluginManagerPort**：插件管理端口抽象（domain 层），向上暴露“目录/安装/启用”等能力。
- **Catalog（目录）**：可安装插件清单（服务端 catalog + repo catalog 合并后的视图）。
- **Installed State（已安装状态）**：某个 server scope 下当前已安装插件与启用状态。
- **Domain Registry（domain 注册表）**：`domain -> renderer/composer/contract` 的索引，供 chat 渲染与输入挂载使用。
- **权限（permissions）**：插件声明的能力开关（例如是否允许网络访问）；host API 会据此进行裁剪。

## 目录结构（约定）

- `data/`：具体实现（HTTP/Tauri commands、运行时加载、repo catalog 等）。
- `domain/`：领域模型、ports、用例（与 UI 无关）。
- `di/`：依赖装配（选择 mock / tauri 实现）。
- `presentation/`：页面、组件、store（与 UI 状态相关）。
- `mock/`：脱离后端的 mock 实现。

## 主要入口（导航）

- 页面：
  - 插件中心：`src/features/plugins/presentation/pages/PluginCenterPage.vue`
  - 插件详情：`src/features/plugins/presentation/pages/PluginDetailPage.vue`
  - Domain 目录：`src/features/plugins/presentation/pages/DomainCatalogPage.vue`
- 领域端口：`src/features/plugins/domain/ports/PluginManagerPort.ts`
- 领域用例：`src/features/plugins/domain/usecases/`
  - 运行时编排用例：`src/features/plugins/domain/usecases/ApplyPluginRuntimeOps.ts`
- 运行时加载：`src/features/plugins/presentation/runtime/pluginRuntime.ts`
- 展示层 store（按 server scope 缓存）：
  - 目录：`src/features/plugins/presentation/store/pluginCatalogStore.ts`
  - 安装状态：`src/features/plugins/presentation/store/pluginInstallStore.ts`
  - 运行时注册表：`src/features/plugins/presentation/store/domainRegistryStore.ts`
  - domain 目录：`src/features/plugins/presentation/store/domainCatalogStore.ts`
  - repo 源：`src/features/plugins/presentation/store/repoSourcesStore.ts`
- store 统一入口（跨 feature 推荐）：`src/features/plugins/presentation/store/index.ts`

## 关键流程（概览）

- 拉取目录（catalog）：
  1) `usePluginCatalogStore(serverSocket).refresh()`
  2) 通过 `PluginManagerPort.listCatalog(server)` 拉取服务端 catalog
  3) 通过 `repoSourcesStore` 拉取 repo catalog（可选）
  4) 合并去重、排序后写入 store（required 优先、按名称排序）
- 安装插件：
  1) UI 选择版本并调用 `InstallPlugin` 用例（经由 `PluginManagerPort.install`）
  2) 后端/原生侧下载 zip、校验 sha256、解压到 per-server 的本地目录
  3) 写入 installed/current/state 等状态文件
  4) 刷新 installed list 并（可选）启用运行时
- 启用/禁用与切换版本：
  - 更新 installed state
  - `DomainRegistryStore` 动态加载对应版本的运行时模块并注册 domains

说明：

- 展示层 `pluginInstallStore` 负责 UI 状态（busy/progress）与错误呈现；
- 版本切换/回滚/运行时校验等编排逻辑已下沉到领域用例 `ApplyPluginRuntimeOps`，避免 store 过重。

## 与其他模块的协作

- `chat`：消费 `DomainRegistryStore` 提供的 renderer/composer，用于消息渲染与输入面板挂载。
- `servers`：提供 server socket 与 server_id（用于插件隔离与安装目录划分；缺失时应阻断安装/启用）。
- `shared/net/*`：HTTP 请求与鉴权头构建；插件网络权限通常由 host API 进行限制。

## 相关文档

- `docs/tmp/prd-api-migration-matrix-v1.1-v1.0.md`
- `docs/design/client/PLUGIN-INSTALL-UPDATE.md`
- `docs/design/client/APP-URL-SPEC.md`
