# chat/message-flow/upload（文件上传任务）

## 定位

`chat/message-flow/upload` 负责聊天消息流中的文件上传任务 UI 编排：任务状态、上传入口、进度展示。
通用传输能力（端口/类型/HTTP/用例）已下沉到 `shared/file-transfer`。
消息语义与文件消息渲染已迁移到 `chat/message-flow/message`。

## 职责边界

做什么：

- 上传任务编排（任务创建、进度状态、失败回显）。
- 文件相关 UI：上传按钮、进度展示。
- 通过 DI 选择具体传输实现（mock/live）。

不做什么：

- 不管理聊天消息本身（由 `chat` feature 管理）。
- 不直接维护服务器上下文（由 `server-connection` 负责），但所有请求通常都按 server scope 隔离。
- 不承载通用文件传输协议实现（由 `shared/file-transfer` 负责）。

## 关键概念

- **上传任务（Upload Task）**：展示层 store 管理的任务状态（队列、进度、失败原因等）。
- **shared/file-transfer**：跨 feature 复用的传输技术层（端口/类型/HTTP/用例）。

## 主要入口（导航）

- 展示层 store：`src/features/chat/message-flow/upload/presentation/store/fileUploadStore.ts`
- DI 组装：`src/features/chat/message-flow/upload/di/upload.di.ts`
- UI 组件：
  - 上传按钮：`src/features/chat/message-flow/upload/presentation/components/FileUploadButton.vue`
  - 进度展示：`src/features/chat/message-flow/upload/presentation/components/UploadProgress.vue`
- 共享传输能力：`src/shared/file-transfer/api.ts`

## 目录结构

- `di/`：依赖装配（mock/live，组合 shared 传输能力）。
- `presentation/`：上传组件、进度与任务 store。
- `mock/`：mock 传输实现（用于 UI 预览）。

## 关键流程（概览）

- 上传：
  1) UI 选择文件并创建上传任务
  2) `fileUploadStore` 通过 DI 获取 `FileServicePort`
  3) 执行“申请上传 + 实际上传”两段式流程并更新进度
  4) 上传完成后由 chat 发送对应“文件消息”（或更新消息附件状态）

## 与其他模块的协作

- `chat`：发送文件消息时依赖 upload 子模块上传结果；文件消息渲染由 chat 负责。
- `server-connection`：提供当前 server socket，决定文件请求与本地缓存的作用域。
- `account`：若下载/上传需要鉴权，通常复用 shared 的 auth session/header 逻辑（而不是在 upload 子模块内重复实现）。
- `shared/file-transfer`：提供可复用的传输实现与抽象，upload 子模块只做任务编排。
