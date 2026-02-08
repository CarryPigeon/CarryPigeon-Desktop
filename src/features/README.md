# `src/features` 结构说明（精简版）

## 1. 总体原则

- 采用 Feature-first 组织：每个功能模块自包含。
- 跨 Feature 只通过 `@/features/<feature>/api` 暴露能力。
- 不保留旧路径兼容，避免隐式耦合。

## 2. 目录职责

每个 feature 按需包含：

- `domain/`：模型、ports、usecases
- `data/`：适配器实现
- `presentation/`：页面、组件、store
- `di/`：依赖组装
- `mock/`、`test/`：按需

约束：`presentation -> di -> domain <- data`

## 3. Mock 模式

真源：`src/shared/config/runtime.ts`

- `off`：真实链路
- `store`：feature 内存 mock
- `protocol`：协议 mock transport（HTTP/WS）

统一选择器：`src/shared/config/mockModeSelector.ts`

补充：`protocol` 下插件 runtime 动态加载默认禁用。

## 4. 各 Feature 快速入口

- `auth`：`src/features/auth/README.md`
- `chat`：`src/features/chat/README.md`
- `files`：`src/features/files/README.md`
- `network`：`src/features/network/README.md`
- `platform`：`src/features/platform/README.md`
- `plugins`：`src/features/plugins/README.md`
- `servers`：`src/features/servers/README.md`
- `settings`：`src/features/settings/README.md`
- `user`：`src/features/user/README.md`

## 5. 常见跨模块调用（示例）

- 插件能力：`import { getPluginManagerPort } from "@/features/plugins/api"`
- 网络连接：`import { connectWithRetry } from "@/features/network/api"`
- 服务器上下文：`import { useCurrentServerContext } from "@/features/servers/api"`

## 6. 深入文档

- 架构总览：`docs/架构设计.md`
- 接入清单：`docs/新Feature接入检查清单.md`
- Mock 联调：`docs/前端调试与Mock.md`
