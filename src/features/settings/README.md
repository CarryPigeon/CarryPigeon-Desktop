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
- 不拥有“清理当前 server 本地工作区”的领域规则；该能力已下沉到 `server-connection` 的服务器管理页。
- 不直接暴露平台底层能力。

## 关键流程

### 1. 设置读取

`presentation/useThemePreferenceModel` 调用 `application/settingsService.readSettings()`，应用层再通过 `di/settings.di.ts` 组装 `GetSettings` 用例和 `SettingsPort` 实现，最终从真实或 mock 存储读取当前设置。

### 2. 主题更新

设置页选择主题后，`useThemePreferenceModel` 调用 `application/settingsService.updateTheme()`；应用层将请求转发给 `SetTheme` 用例，再由 `SettingsPort` 实现落到 localStorage 或 mock 存储。

## 目录语义

- `application/`：feature 内部编排与稳定服务入口。
- `domain/`：settings 领域类型、端口与用例。
- `data/`：真实存储适配器。
- `mock/`：mock 存储适配器。
- `di/`：依赖装配与 mock/live 选择。
- `presentation/`：设置页及其子模型（当前为主题偏好）。

## 主要文件

- `src/features/settings/api.ts`
- `src/features/settings/application/settingsService.ts`
- `src/features/settings/domain/ports/SettingsPort.ts`
- `src/features/settings/domain/types/SettingsTypes.ts`
- `src/features/settings/domain/usecases/GetSettings.ts`
- `src/features/settings/domain/usecases/SetTheme.ts`
- `src/features/settings/data/localStorageSettingsPort.ts`
- `src/features/settings/presentation/composables/useSettingsPageModel.ts`
- `src/features/settings/presentation/composables/useThemePreferenceModel.ts`

## 相关文档

- `src/features/README.md`
