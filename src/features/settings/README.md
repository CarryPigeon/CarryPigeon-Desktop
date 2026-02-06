# settings（设置与配置）

## 定位

settings 负责“应用设置”的前端落地：将配置项抽象为 domain ports/usecases，并提供设置页 UI 与必要的展示层状态。目前主要覆盖主题等基础配置，但结构允许逐步扩展为更多配置项。

## 职责边界

做什么：

- 配置读取与写入的用例封装（例如主题切换）。
- 设置页 UI 与配置项展示。
- mock/live 配置源切换（由 DI 决定）。

不做什么：

- 不包含具体业务流程（例如聊天/插件逻辑）；settings 只提供配置能力。
- 不直接操作平台 API（如需平台能力应通过 `platform` feature）。

## 主要入口（导航）

- 设置页：`src/features/settings/presentation/pages/SettingPage.vue`
- 领域端口：`src/features/settings/domain/ports/ConfigPort.ts`
- 领域用例：
  - `src/features/settings/domain/usecases/GetConfig.ts`
  - `src/features/settings/domain/usecases/SetTheme.ts`
- data 实现：`src/features/settings/data/localStorageConfigPort.ts`

## 目录结构

- `domain/`：配置 ports/types/usecases。
- `data/`：配置存取实现（本地/后端等）。
- `di/`：依赖装配（mock/live）。
- `presentation/`：设置页与展示层状态。
- `mock/`：mock 配置源。

## 相关文档

- `docs/项目简介.md`
