# user（用户与个人信息）

## 定位

user 负责“用户域”的客户端落地：用户信息读取、列表查询、个人资料更新，以及当前用户（current user）的展示层缓存。其他 feature（chat/plugins）会读取当前用户上下文（uid、语言等）用于业务流程与 UI 展示。

## 职责边界

做什么：

- 提供用户相关 domain ports/usecases（获取当前用户、按 id 获取、列表、更新邮箱/资料等）。
- 提供用户相关页面与 popover UI。
- 管理 `currentUser` 展示层状态，供其他模块读取（尽量只读共享）。

不做什么：

- 不负责认证登录（由 `auth` feature 负责），但会在登录成功后被调用以刷新当前用户信息。
- 不负责 server socket 上下文（由 `servers` 负责），但用户请求通常同样按 server scope 隔离。

## 主要入口（导航）

- 当前用户 store：`src/features/user/presentation/store/userData.ts`
- 页面：
  - 用户资料页：`src/features/user/presentation/pages/UserInfoPage.vue`
  - 用户信息 popover：`src/features/user/presentation/pages/UserPopoverPage.vue`
- 领域端口：`src/features/user/domain/ports/UserServicePort.ts`
- 领域用例：`src/features/user/domain/usecases/`
  - `GetCurrentUser.ts`
  - `GetUser.ts`
  - `ListUsers.ts`
  - `UpdateUserEmail.ts`
  - `UpdateUserProfile.ts`
- HTTP 适配：`src/features/user/data/httpUserServicePort.ts`、`src/features/user/data/httpUserApi.ts`

## 目录结构

- `domain/`：用户 ports/types/usecases。
- `data/`：HTTP 适配器与服务工厂。
- `di/`：依赖装配（mock/live）。
- `presentation/`：页面与 store（例如 `currentUser`）。
- `mock/`：mock 用户服务。

## 关键流程（概览）

- 刷新当前用户：
  1) 调用 `GetCurrentUser` 用例
  2) 通过 `UserServicePort` 获取用户信息
  3) 写入 `currentUser`（展示层缓存），供 chat/plugins 等读取上下文
- 更新个人资料/邮箱：
  1) UI 提交表单
  2) 调用 `UpdateUserProfile` / `UpdateUserEmail`
  3) 成功后刷新 `currentUser`，保证 UI 一致性

## 与其他模块的协作

- `auth`：登录成功后通常会触发 `user` 刷新 current user。
- `chat`：发送消息/渲染头像/显示用户信息时读取 `currentUser`。
- `plugins`：构建插件上下文时会读取 uid/lang 等，注入到插件 host API。
