## shared/file-transfer

### 定位

`shared/file-transfer` 提供跨 feature 复用的文件传输技术能力，不包含具体业务页面或任务 UI 语义。

### 负责内容

- 传输抽象：`FileServicePort`、传输类型定义。
- 传输实现：HTTP 两段式上传与下载 URL 构建。
- 通用用例：请求上传、执行上传、构建下载 URL。

### 不负责内容

- 上传任务队列与 UI 交互状态（由 `chat/message-flow/upload` 负责）。
- 聊天消息中的文件语义渲染（由 `chat/message-flow/message` 负责）。
