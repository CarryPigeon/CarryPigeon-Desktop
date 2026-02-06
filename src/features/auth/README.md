# auth（认证与登录）

## 定位

auth 负责“用户如何在某个服务器上下文中完成登录并获得可用会话”的完整链路：从 UI 表单输入开始，到领域用例编排，再到 HTTP/mock 适配器落地。

## 职责边界

做什么：

- 登录：邮箱验证码登录、token 登录等（领域用例 + UI）。
- 会话：刷新 token、撤销 token（领域用例）。
- 认证相关依赖装配：根据运行时 mock 配置选择 mock/live 实现。

不做什么：

- 不维护“当前服务器选择”（由 `servers` feature 管理）。
- 不负责网络传输细节（复用 `src/shared/net/*`），也不直接依赖 Tauri API。

## 关键概念

- **AuthServicePort**：认证服务抽象端口（domain 层），描述“需要的能力”，不绑定实现（HTTP/mock）。
- **用例（usecases）**：把“认证流程”封装成可测试的业务步骤（例如发送验证码、登录、刷新 token）。
- **Required Gate（必需项门禁）**：当运行时缺少必要能力（例如缺少必需插件）时，用于阻断并提示用户的展示层门禁状态（见 `presentation/store/requiredGate.ts`）。

## 主要入口（导航）

- DI（选择 mock/live 实现）：`src/features/auth/di/auth.di.ts`
- HTTP 实现：`src/features/auth/data/httpAuthServicePort.ts`、`src/features/auth/data/httpEmailServicePort.ts`
- 领域 ports：`src/features/auth/domain/ports/AuthServicePort.ts`、`src/features/auth/domain/ports/EmailServicePort.ts`
- 领域用例：`src/features/auth/domain/usecases/`
- 页面：
  - 登录页：`src/features/auth/presentation/pages/LoginPage.vue`
  - 必需配置页：`src/features/auth/presentation/pages/RequiredSetupPage.vue`
- 展示层门禁 store：`src/features/auth/presentation/store/requiredGate.ts`

## 目录结构

- `domain/`：认证领域模型、ports、用例、错误类型。
- `data/`：HTTP 实现与工厂（构建 ports 的具体实现）。
- `di/`：依赖装配（mock/live 的选择逻辑）。
- `presentation/`：登录页、必需配置页、展示层 store。
- `mock/`：用于 UI/开发态的 mock ports。

## 关键流程（概览）

- 发送验证码：
  1) UI 调用 `SendVerificationCode` 用例
  2) 用例通过 `EmailServicePort` 发送请求（HTTP 或 mock）
  3) UI 根据结果展示倒计时/错误提示
- 邮箱验证码登录：
  1) UI 调用 `LoginWithEmailCode` 用例
  2) 用例通过 `AuthServicePort` 获取 token 并持久化（具体策略由实现决定）
  3) 登录成功后刷新用户信息（通常由 `user` feature 承接）
- 会话维护：
  - `RefreshToken` 用于续期
  - `RevokeToken` 用于登出/撤销

## 与其他模块的协作

- `servers`：提供当前 server socket 与 TLS 配置，auth 的 HTTP 请求通常需要基于该上下文构建 origin 与请求头。
- `user`：登录成功后通常需要拉取当前用户并写入 `currentUser` 状态。
- `network`：在某些“需要 TCP 握手/连接”的流程中，auth 页面可能会触发连接（取决于当前 UI 编排）。

## 调试与验证

- 前端静态检查：`npm run lint`、`npx vue-tsc --noEmit`
- mock 模式：见 `src/shared/config/runtime.ts` 与 `docs/前端调试与Mock.md`
