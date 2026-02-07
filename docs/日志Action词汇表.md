# 日志 Action 词汇表（分层规范 v2）

> 适用范围：`src/**` 与 `src-tauri/src/**` 的日志 action。

## 1) 命名模型（强制）

- 统一格式：`<domain>_<subdomain>_<event_or_object>_<state>`。
- 命名风格：全小写 `snake_case`。
- 时态规范：
  - `*_started`：开始
  - `*_succeeded`：成功
  - `*_completed`：完成
  - `*_failed`：失败
  - `*_skipped`：跳过
  - `*_ignored`：忽略
  - `*_scheduled`：已调度

## 2) 前端 domain 前缀（强制）

- `chat_`：聊天、WS、追赶逻辑
- `network_`：TCP、握手、加密、帧收发
- `plugins_`：插件安装/运行态
- `servers_`：服务配置与信息
- `auth_`：认证会话
- `http_`：HTTP 客户端与降级链路
- `api_`：统一 API 错误与协议码

## 3) Rust domain 前缀（强制）

- `app_`：应用生命周期/托盘/窗口入口
- `network_`：网络与下载
- `plugins_`：插件运行态
- `settings_`：配置读写
- `windows_`：窗口变更
- `db_`：数据库连接
- `tauri_`：Tauri 命令通用错误
- `test_`：测试辅助日志

## 4) 二次分层迁移（本次）

- `ws_auth_opened` → `chat_ws_auth_opened`
- `ws_command_failed` → `chat_ws_command_failed`
- `ws_message_received` → `chat_ws_message_received`
- `catch_up_resume_failed` → `chat_catch_up_resume_failed`
- `tcp_send_failed` → `network_tcp_send_failed`
- `handshake_completed` → `network_handshake_completed`
- `connect_server_started` → `network_connect_server_started`
- `connect_server_succeeded` → `network_connect_server_succeeded`
- `plugin_install_failed` → `plugins_install_failed`
- `list_plugin_catalog_failed` → `plugins_catalog_list_failed`
- `get_server_info_failed` → `servers_info_get_failed`
- `auth_refresh_failed` → `auth_session_refresh_failed`
- `http_request_failed` → `http_client_request_failed`
- `app_started` → `app_lifecycle_started`
- `config_parse_failed` → `settings_config_parse_failed`
- `db_open` → `db_connection_opened`
- `avatar_download_progress` → `network_avatar_download_progress`

## 5) 守门检查

- 前端：`bash scripts/check-log-standards.sh`
  - 检查 `console.*` 禁用
  - 检查 `Action: <snake_case>`
  - 检查二次分层前缀
- Rust：`bash scripts/check-rust-standards.sh`
  - 检查 `action` 字段必填
  - 检查二次分层前缀
  - 检查其他 Rust 统一标准
