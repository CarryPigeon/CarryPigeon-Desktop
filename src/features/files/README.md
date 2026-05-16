# files Feature

## 定位
文件管理与浏览器。列出当前服务器的已上传文件，支持搜索、类型筛选、下载。

## 边界
- 仅查询当前已连接服务器的文件列表（server-scoped）。
- 不负责文件上传（upload 属于 chat/message-flow/upload）。
- 文件列表数据来自服务端 API（mock 模式使用本地 mock）。

## 入口
- `api.ts` — `getFilesCapabilities()`
- `routes.ts` — `FileManagerPage`（路由 `/files`）

## 关键流程
1. 用户进入文件管理页面
2. 通过 `FileListPort` 获取文件列表
3. 用户可按文件名搜索、按类型筛选
4. 点击行内的下载按钮触发下载（复用 download store）
