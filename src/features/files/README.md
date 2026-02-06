# files（文件上传与文件消息）

## 定位

files 负责“文件作为一种业务资源”的客户端侧落地：向后端申请上传、分片/直传上传（取决于实现）、以及在聊天时间线中渲染文件消息（附件气泡、下载入口等）。

## 职责边界

做什么：

- 文件上传用例编排（申请上传、执行上传、获取下载链接）。
- 文件相关 UI：上传按钮、进度展示、文件消息气泡。

不做什么：

- 不管理聊天消息本身（由 `chat` feature 管理）；files 只提供“文件消息如何渲染/如何上传下载”的能力。
- 不直接维护服务器上下文（由 `servers` 负责），但所有请求通常都按 server scope 隔离。

## 关键概念

- **FileServicePort**：文件服务抽象端口（domain 层），用于屏蔽 HTTP/mock 差异。
- **上传任务（Upload Task）**：展示层 store 管理的任务状态（队列、进度、失败原因等）。

## 主要入口（导航）

- 领域端口：`src/features/files/domain/ports/FileServicePort.ts`
- 领域用例：`src/features/files/domain/usecases/`
  - `RequestFileUpload.ts`：申请上传（拿到上传参数/目标）
  - `PerformFileUpload.ts`：执行上传（网络传输）
  - `GetDownloadUrl.ts`：获取下载 URL（用于点击下载/预览）
- 展示层 store：`src/features/files/presentation/store/fileUploadStore.ts`
- UI 组件：
  - 上传按钮：`src/features/files/presentation/components/FileUploadButton.vue`
  - 进度展示：`src/features/files/presentation/components/UploadProgress.vue`
  - 文件消息气泡：`src/features/files/presentation/components/FileMessageBubble.vue`

## 目录结构

- `domain/`：文件相关 ports/types/usecases。
- `data/`：HTTP 实现与工厂。
- `di/`：依赖装配（mock/live）。
- `presentation/`：上传组件、进度与 store。
- `mock/`：mock 实现。

## 关键流程（概览）

- 上传：
  1) UI 选择文件并创建上传任务
  2) `RequestFileUpload` 申请上传参数（例如 uploadId、目标 URL、限制等）
  3) `PerformFileUpload` 执行上传并持续上报进度
  4) 上传完成后由 chat 发送对应“文件消息”（或更新消息附件状态）
- 下载：
  1) UI 点击下载/预览
  2) `GetDownloadUrl` 获取可用 URL（可能包含鉴权参数）
  3) 交给浏览器/平台能力打开或保存

## 与其他模块的协作

- `chat`：渲染消息时调用 files 组件；发送文件消息时依赖 files 的上传结果。
- `servers`：提供当前 server socket，决定文件请求与本地缓存的作用域。
- `auth`：若下载/上传需要鉴权，通常复用 shared 的 auth session/header 逻辑（而不是在 files 内重复实现）。
