# account（身份域）

## 定位

`account` 统一承载身份相关能力，替代旧的 `auth + user` 拆分。

## 职责边界

做什么：

- 管理登录认证链路、required gate 校验与认证错误语义。
- 提供当前用户展示快照，以及用户资料查询/更新入口。
- 为 app/chat/plugins 等其它 feature 提供稳定的身份域公共入口。

不做什么：

- 不维护 server 连接与工作区选择；这些由 `server-connection` 负责。
- 不承担插件安装/启用状态本身；`auth-flow` 只消费插件查询 provider。
- 不要求子特性彼此通过 `account/api.ts` 通信；该入口只服务跨 feature。

## 跨 Feature 入口

- 能力入口（主模式）：`src/features/account/api.ts` 的 `createAccountCapabilities()`（必要时可用 `getAccountCapabilities()`）
- 类型入口：`src/features/account/api-types.ts`
- 路由入口：`src/features/account/routes.ts`

约束：

- 跨 feature 不应直接依赖 `auth-flow/*`、`profile/*`、`current-user/*` 内部路径。
- 跨 feature 统一通过 capability 对象调用 account 能力。
- 根 capability 只暴露直接命令与快照能力，不暴露内部 usecase 对象。
- `account` 内部子特性之间优先依赖各自子域 API 或 contracts，不反向依赖聚合 `account/api.ts`。

## 关键概念

- **auth-flow**：登录、发码、required gate、认证错误语义。
- **profile**：用户资料查询/更新用例与 profile mutation 支持性判断。
- **current-user**：面向展示层的“当前用户快照”，不是 account 领域事实源。
- **current-user snapshot sync**：`me/profile` 是权威事实源，`current-user` 只是展示快照；跨 feature 若需同步当前用户，应通过 `account/api.ts` 暴露的快照同步能力，而不是直连 `application/*`。
- **required-setup plugin workspace**：required-setup 页面通过 account 自己的 integration 层把 plugins 的 plain controller 适配为本地响应式视图，不再直接把 plugins 的公共 API 绑定为 Vue `ComputedRef` 契约。
- **api/api-types 分离**：`api.ts` 暴露稳定值入口，`api-types.ts` 暴露稳定类型入口，避免把 domain/data 路径扩散到外部消费者。

## 目录结构

- `auth-flow`：验证码登录、required gate 校验、认证错误判定。
- `profile`：用户资料读写用例。
- `current-user`：当前用户展示态与用户弹窗页面。
- `routes.ts`：account 页面级公共路由入口。

## 主要入口

- capability 工厂：`src/features/account/api.ts`（`createAccountCapabilities` / `getAccountCapabilities`）
- 聚合公共类型：`src/features/account/api-types.ts`
- 登录页路由：`src/features/account/routes.ts`
- auth-flow 子域公共 API：`src/features/account/auth-flow/api.ts`
- profile 子域公共 API：`src/features/account/profile/api.ts`
- current-user 子域公共 API：`src/features/account/current-user/api.ts`
