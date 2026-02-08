# 协议总览（草案）

本文作为 PRD 的协议配套说明，用于把“产品语义”落到可实现的路由、字段与事件。

## 1. 传输层
- TCP：加密握手 + 业务请求/响应 + 推送
- HTTP：插件包/静态资源下载、（后续）文件上传下载

## 2. 关键对象
- 用户（uid/token）
- 频道（cid）
- 消息（mid、domain、domain_version、data、reply_to_mid）
- 插件（plugin_id、版本、权限、contracts）
- 服务器身份（server_id：服务端返回的固定 UUID，客户端用于本地隔离与缓存）

## 2.1 server_id 来源（P0，已确定）
客户端必须从“服务器信息接口”获取 `server_id`（固定 UUID）。本项目建议该接口为：
- `GET /core/server/data/get`（或等价能力）

要求：
- `server_id` 必须稳定（同一服务器长期不变）。
- 客户端在未获取到 `server_id` 前，不得执行插件安装/启用（避免把插件安装到错误的隔离域）。

若服务端暂未提供 `server_id`：
- 客户端应提示“服务器版本不兼容（缺少 server_id）”，并禁用插件安装入口。

## 3. Required Gate（必须）
- 连接后必须先获取插件目录与 required
- 未满足 required 时：允许安装插件与查看服务器信息；禁止登录相关能力

## 4. 推送（最小化）
- `message.create` 与 `message.delete` 仅携带必要字段 + 可选 preview
