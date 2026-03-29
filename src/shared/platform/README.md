# shared/platform（平台能力封装）

## 定位

`shared/platform` 负责把桌面端平台能力抽象为可测试、可替换的端口与用例，并通过 Tauri 适配器落地。  
该目录仅承载技术能力，不承载业务状态或业务规则。

## 主要入口

- 聚合 API：`src/shared/platform/api.ts`
- 领域端口：`src/shared/platform/domain/ports/WindowCommandsPort.ts`
- 领域用例：`src/shared/platform/domain/usecases/*`
- Tauri 适配器：`src/shared/platform/data/tauriWindowCommandsAdapter.ts`
- 依赖组装：`src/shared/platform/di/windows.di.ts`

