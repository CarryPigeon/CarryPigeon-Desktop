# settings（设置域）

## 定位

`settings` 负责“应用级本地设置”的读取、写入与展示。目前核心内容是主题配置与设置页编排，可继续承载更多本地设置项。

## 跨 Feature 入口

- 跨 feature 公共 API：`src/features/settings/api.ts`
- 跨 feature 公共类型：`src/features/settings/api-types.ts`
- 路由入口：`src/features/settings/routes.ts`

当前公开能力：

- 主入口（capability-first）：
  - `createSettingsCapabilities()`：创建 settings 能力对象。
  - `getSettingsCapabilities()`：获取 settings 应用级能力对象。
- 能力对象契约：`SettingsCapabilities`
  - `readSettings()`：读取当前应用设置快照。
  - `updateTheme(theme)`：更新当前主题。

边界约定：

- 跨 feature 只能依赖 `api.ts` / `api-types.ts` / `routes.ts`。
- `di/`、`domain/`、`data/`、`presentation/` 均属于 feature 内部实现细节。
- 跨 feature 统一通过 `SettingsCapabilities` 调用 settings 能力。

## 职责边界

做什么

- 读取当前应用设置快照。
- 更新主题等本地设置项。
- 提供设置页的页面编排和 UI 展示。
- 根据 mock mode 装配真实或 mock 的设置存储。

不做什么

- 不承载聊天、插件、账号等业务逻辑。
- 不拥有插件体系本身：插件设置项的注册表在 `plugins` feature，`settings` 只消费其只读响应式投影（跨 feature 入口为 `@/features/plugins/api`）。
- 不拥有“清理当前 server 本地工作区”的领域规则；该能力已下沉到 `server-connection` 的服务器管理页。
- 不直接暴露平台底层能力。

## 关键流程

### 1. 设置读取

`presentation/useThemePreferenceModel` 调用 `application/settingsService.readSettings()`，应用层再通过 `di/settings.di.ts` 组装 `GetSettings` 用例和 `SettingsPort` 实现，最终从真实或 mock 存储读取当前设置。

### 2. 主题更新

设置页选择主题后，`useThemePreferenceModel` 调用 `application/settingsService.updateTheme()`；应用层将请求转发给 `SetTheme` 用例，再由 `SettingsPort` 实现落到 localStorage 或 mock 存储。

### 3. 分区切换（左栏 Tab 导航）

设置页右栏是 Tab 面板容器（`.cp-settings__sections`），左栏导航即 `role="tablist"`（每项 `role="tab"`，选中态由 `data-active` + `aria-selected` 表达）：

- 一次只显示当前分区的面板（`v-show`）；非当前面板隐藏但**保持挂载**，插件设置项控件与 `AiProviderSettings` 不会在切换时重新挂载或重新打 IPC；
- 点击导航项调用 `setActiveSection()`：切换面板后把容器 `scrollTop` 复位到顶部；不再对整页做 `scrollIntoView`，原先基于 `IntersectionObserver` 的滚动高亮已移除；
- 「插件设置」（当前 server 无插件设置项时）与「关于」（应用信息未就绪时）导航项不出现，保证每个导航项都有已渲染面板；分区集合变化后若当前 Tab 已不存在，自动回退到第一个分区（`general`）。

### 4. 设置搜索

设置页左栏搜索框（`SettingsPage.vue` + 纯逻辑 `presentation/settingsSearch.ts`）基于单一真源 `presentation/settingsCatalog.ts`：

- `SETTINGS_SECTIONS`：分区顺序与文案 key（含「插件设置」分区）；
- `SETTINGS_CATALOG`：内置设置项索引（锚点 id + 标题/说明文案 key + 追加关键词）；
- 模板中每个设置项通过 `data-settings-item="<锚点>"` 与索引一一对应，
  `SettingsPage.search.test.ts` 会断言索引中的锚点全部存在于 DOM（防止漂移）；
- 匹配规则：标题 + 说明 + 关键词 + 分区名/副标题 + 锚点 +（插件项的）插件 id，空格分词取 AND，大小写不敏感子串匹配；
- 有查询时结果列表替换左栏导航，点击/回车先把右栏切到目标分区 Tab（见上），再在面板内滚动到目标并短暂高亮（`cp-settings__flash`），Esc 或清空按钮恢复导航。

### 5. 插件设置项（「插件设置」分区）

插件通过 `ctx.ui.registerSettingsItem(...)` 注册设置项（宿主侧注册表见 `plugins` feature）：

- `presentation/composables/usePluginSettings.ts` 读取**当前 server**（`normalizeServerKey(currentServerSocket)`）的插件设置项：
  - `items()` / `groups()` 来自 `getPluginsCapabilities().forServer(socket).listPluginSettingsItems()`（响应式投影，插件启停自动更新）；
  - `ensureLoaded()` 在设置页挂载时触发一次当前 server 的插件运行时加载（幂等、失败只告警）；无当前 server 时不展示插件分区；
- 设置页把插件项渲染进「插件设置」分区（按插件分组、单项独立 `ErrorBoundary`、宿主提供卡片外壳），并把同一份数据并入搜索索引。

## 目录语义

- `application/`：feature 内部编排与稳定服务入口。
- `domain/`：settings 领域类型、端口与用例。
- `data/`：真实存储适配器。
- `mock/`：mock 存储适配器。
- `di/`：依赖装配与 mock/live 选择。
- `presentation/`：设置页、设置索引/搜索纯逻辑、子模型与插件设置项组合式函数。

## 主要文件

- `src/features/settings/api.ts`
- `src/features/settings/application/settingsService.ts`
- `src/features/settings/domain/ports/SettingsPort.ts`
- `src/features/settings/domain/types/SettingsTypes.ts`
- `src/features/settings/domain/usecases/GetSettings.ts`
- `src/features/settings/domain/usecases/SetTheme.ts`
- `src/features/settings/data/localStorageSettingsPort.ts`
- `src/features/settings/presentation/settingsCatalog.ts`
- `src/features/settings/presentation/settingsSearch.ts`
- `src/features/settings/presentation/composables/useSettingsPageModel.ts`
- `src/features/settings/presentation/composables/usePluginSettings.ts`
- `src/features/settings/presentation/composables/useThemePreferenceModel.ts`

## 相关文档

- `src/features/README.md`
