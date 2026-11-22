# 桌面客户端 Server API 迁移对照

依据用户提供的 `03-api (1).md`。下表路径以 `/api` 为公共前缀，`{cid}`、`{uid}`、`{mid}` 等分别代表频道、用户和消息 ID。旧列记录迁移前客户端的实际请求与读取字段。表中响应字段均指业务数据。

旧客户端直接读取成功 JSON，通常以 HTTP 状态和 `error.reason` 判断失败，部分写接口接受 HTTP 204。新协议使用 `{code,message,data}`，无返回值时 `data` 为 `null`。失败仅返回 `{code,message}`，即使 HTTP 200 也要按 `code` 判断。响应 ID 为十进制字符串，时间为 Unix 毫秒。页码分页使用 `page,page_size` 和 `items,page,page_size,total,has_more`。游标分页使用 `cursor,limit` 和 `items,next_cursor,has_more`。游标原样传回，末页 `next_cursor` 为 `null`，升级后从首页重新获取。

## 认证和用户资料

| 方法与旧路径 | 旧参数和响应 | 新规范及差异 |
| --- | --- | --- |
| `POST /auth/email_codes` | `{email}`，忽略响应体 | 增加 `purpose`。注册 `REGISTER`，登录 `LOGIN`，换邮箱 `CHANGE_EMAIL`，改密发码使用已确认的 `password_change`。 |
| `POST /auth/register` | `{username,password}` → `{uid,username}`。另一注册入口借用邮箱登录的 `is_new_user` | 增加 `email,code`，保留注册结果字段。 |
| `POST /auth/login` | `{username,password}` → 令牌 | 迁往 `/auth/login/pwd`。 |
| `POST /auth/tokens` | `{grant_type:"email_code",email,code,client:{device_id,installed_plugins}}` → 令牌及可选 `is_new_user` | 迁往 `/auth/login/email`，发送 `{email,code}`。登录和刷新令牌数据均为 `{token_type,access_token,expires_in,refresh_token,uid}`。 |
| `POST /auth/refresh`、`POST /auth/revoke` | `{refresh_token,client:{device_id}}` → 新令牌或无响应体 | 路径保留，请求只含 `refresh_token`。撤销成功为 `null`。 |
| `PUT /users/me/email` | `{email,code}`，忽略响应体 | 迁往 `/auth/me/email`。新增 `PUT /auth/me/password`，发送 `{password,code}`。 |
| `GET /users/{uid}` | 无请求体，主要读取 `uid,nickname,avatar`，可读 `email,bio,background_url` | 迁往 `/users/{uid}/detail`。详情字段为 `uid,username,avatar,email,bio,sex,birthday`。 |
| `GET /users?ids=…` | 逗号分隔 ID → `{items:[{uid,nickname,avatar}]}` | 路径和查询不变，条目改用 `username`，头像可为 `null`。 |
| `GET /users/me` | 无请求体 → `uid,nickname,email,avatar` | 路径保留，字段同用户详情。 |
| `PATCH /users/me` | `{username,avatar,brief,sex,birthday}`，忽略响应体 | 请求只包含待更新的 `avatar,brief,sex,birthday`，回读简介为 `bio`。 |
| `POST /users/me/background` | multipart 字段 `background` → `{background_url}` | 新资料契约没有背景上传或背景字段。 |

## 频道、申请、成员和禁言

| 方法与路径 | 旧参数和响应 | 新规范及差异 |
| --- | --- | --- |
| `GET /channels/discover` | 查询 `q,limit,cursor,type` → `{items,next_cursor,has_more}` | 去掉 `type`。条目含 `cid,name,brief,avatar,member_count,requires_application`。头像和游标允许 `null`。 |
| `GET /channels` | 无分页查询 → `{channels}` | 改用页码分页，频道摘要为 `{cid,name,brief,system_channel,created_at}`。 |
| `GET /channels/{cid}`、`POST /channels` | 详情无请求体，创建 `{name,brief,avatar}`，返回频道对象 | 创建仅发送 `{name,brief}`。两者返回频道摘要，所有者权限由成员角色取得。 |
| `PATCH /channels/{cid}`、`DELETE /channels/{cid}` | 更新 `{name,brief,avatar?}`，读取频道对象或再查询。删除无请求体 | 更新仅传 `name,brief`，成功取 `null` 后重新读取详情。删除路径与参数一致。 |
| `POST /channels/list`、`PUT /channels/{cid}/transfer`、`POST /channels/{cid}/quit` | 无 | 批查发送 ID 字符串数组 → `{total,items}`。转让发送 `{new_owner}`，退出无请求体，两者成功返回 `null`。 |
| `POST /channels/{cid}/applications`、`POST /channels/{cid}/applications/{id}/decisions` | `{reason}` 或 `{decision:"approve"｜"reject"}`，忽略响应体 | 请求一致。成功返回 `{application_id,cid,uid,reason,apply_time,status}`，通过状态使用 `accepted`。 |
| `GET /channels/{cid}/applications` | 无分页查询 → `{items}` | 页码分页。新增 `GET /channels/applications` 查询我的申请。 |
| `GET /channels/{cid}/members` | 无分页查询 → `{items:[{uid,nickname,avatar,role,join_time}]}` | 页码分页，成员名字段为 `username`。 |
| `PUT`、`DELETE /channels/{cid}/admins/{uid}`；`DELETE /channels/{cid}/members/{uid}` | 无请求体，对应授予管理员、撤销管理员和踢出成员 | 路由和参数一致。 |
| `PUT`、`DELETE /channels/{cid}/bans/{uid}`；`GET /channels/{cid}/bans` | 禁言发送 `{until,reason}`。旧映射读取 `expires_at,created_at`。解除无请求体，列表无分页 | 禁言记录为 `{cid,uid,until,reason,create_time}`，列表采用页码分页。 |

## 消息和 WebSocket

| 功能与路径 | 旧参数和响应 | 新规范及差异 |
| --- | --- | --- |
| `POST /channels/{cid}/messages` | `domain,domain_version,data,mentions,client_message_id` 及 `Idempotency-Key`。文本用 `Core:Text` 和 `data.text`，回复使用独立域 | 使用带 `:V1` 版本的核心域。文本 `data:{content,reply_to_mid?}`。响应为 `{mid,uid,cid,domain,data,preview,mentions,send_time}`。文档未承诺旧发送幂等语义。 |
| `GET /channels/messages/{mid}`、`POST /channels/messages/ids` | 无 | 单查返回消息。批查发送 `{message_ids}`，返回 `{total,items}`。 |
| `POST /channels/{cid}/messages/{mid}/recall` | 无请求体 → 完整撤回消息对象 | 请求一致，成功返回 `null`。 |
| `GET /channels/{cid}/messages` 翻页 | 同一路径请求 `cursor?,limit` | 首次取 `?limit=20`，更旧走 `/before?cursor=…&limit=…`，两者按 MID 数值降序。新增 `/after` 按 MID 数值升序，供增量场景使用。 |
| `GET /channels/{cid}/messages` 锚点 | `around_mid,before,after` → 游标分页 | `/messages/around?anchor_mid=…&before=…&after=…`，范围均为 `0..50`，只返回 `{items}`。 |
| `GET /channels/{cid}/messages/search` | `q,cursor,limit,sender_uid,domain,before_mid,after_mid` | 保留 `q,cursor,limit,sender_uid,domain`，按 MID 数值降序。 |
| `POST /messages/{mid}/forward` | `{target_cid,comment,merged_mids,idempotency_key}` → 消息 | 改向目标频道发送 `Core:Forward:V1`，`data:{source_channel_id,message_ids}`。按确认后的交互，转发完成后把附言作为目标频道的一条文本消息单独发送。 |
| `POST /channels/{cid}/messages/attachments` | multipart `file,message_type` → `{object_key,share_key,filename,mime_type,size}` | 使用第 11 节的上传流程，再以 `share_key` 发送 `Core:Image:V1`、`Core:Voice:V1` 或 `Core:Attachment:V1`。 |
| `WS /api/ws` | `auth.data:{access_token,device_id,resume}`，保存 `last_event_id`。消息事件携带完整消息或 `{cid,mid,recall_time}` | 首帧 `auth.data:{access_token}`。消息创建、撤回事件携带 `{channel_id,message_id,event_sequence}`。客户端收到事件后补查或刷新。每次重连重新鉴权并取首页，无事件续播。沿用 `reauth` 和 `ping`。 |

## 提及、已读和未读

| 路径 | 旧参数和响应 | 新规范及差异 |
| --- | --- | --- |
| `GET /mentions` | `cursor,limit,unread_only,cid?` → 提及游标分页 | 个人参数保留 `cursor,limit,unread_only`。频道改走 `/channels/{cid}/mentions`。提及字段为 `{mention_id,cid,mid,from_uid,target,created_at,read}`。 |
| `GET /mentions/{id}`、`POST /mentions/ids` | 无 | 单查返回记录，批查发送 `{mention_ids}`，结果按首次出现顺序去重并略过不可见项。读取不标记已读。 |
| `PUT /mentions/{id}/read` | 无请求体 | 路由和参数一致，成功为 `null`。 |
| `PUT /mentions/read_state` | `{before_mention_id?,cid?}` | 全局改 `/mentions/read`，频道改 `/channels/{cid}/mentions/read`。不带请求体表示全部，按上界时发送 `{through_mention_id}`。 |
| `PUT /channels/{cid}/read_state` | `{last_read_mid,last_read_time}` → `{cid,uid,last_read_mid,last_read_time}` | 发送 `{last_read_mid}`，返回 `{cid,uid,last_read_mid}`。服务端按 MID 数值推进。新增 GET 读取相同字段和 `unread_count`，锚点可为 `null`。 |
| `GET /unreads` | 返回 `{items}`，记录读取 `cid,unread_count,last_read_time,mention_unread_count?` | 返回 `{total,items:[{cid,unread_count}]}`。仅列出有未读的已加入频道，排除自己发送和已撤回消息，每频道最多计为 `10000`。 |

## 文件和服务发现

| 路径 | 旧参数和响应 | 新规范及差异 |
| --- | --- | --- |
| `POST /files/uploads` | `{filename,mime_type,size_bytes,sha256?}` → `{file_id,share_key,upload:{method,url,headers,expires_at}}` | 发送 `{filename,size_bytes,sha256}`。`upload.has_same` 为 `true` 时直接使用 `share_key`。 |
| `PUT` 上传授权 URL | 已使用 Bearer 和原始字节，只判断 HTTP 状态 | 保留原始字节，明确文件长度、内容类型，核对业务成功响应。 |
| `GET /files/download/{share_key}` | Bearer，无请求体，成功读取二进制 | 请求和成功格式一致，失败可能附带业务 JSON。 |
| `GET /files/download/server/head` | 界面从旧服务发现 `avatar` 字段取 URL | 使用公开固定路径，返回图片二进制。 |
| `GET /server` | 无请求体，读取裸 `{server_id,name,brief,ws_url,server_time}` 及部分扩展字段 | 路由和核心字段一致，成功统一拆包。 |
| `GET /internal/readiness` | 无 | 独立部署探针，按 HTTP 204、503、403 判断就绪、未就绪和权限，响应无业务 JSON。 |

## 另有规范的功能

已确认插件目录、域目录、登录前插件预检、消息置顶、审计日志、服务端免打扰同步和文件库管理另有接口规范，本轮保留其调用。独立插件仓库与 CarryPigeon 聊天 Server 接口分别对接。

| 现有路由 | 旧请求和响应 |
| --- | --- |
| `GET /plugins/catalog`、`GET /domains/catalog` | 免认证，无查询参数，分别读取 `plugins[]` 和 `items[]`。 |
| `POST /gates/required/check` | `{client:{device_id,installed_plugins}}` → `{missing_plugins}`。 |
| `POST`、`DELETE /channels/{cid}/pins/{mid}`；`GET /channels/{cid}/pins` | 新增可带 `{note}`。列表查询 `cursor,limit`，返回置顶记录游标分页。 |
| `GET /audit_logs` | `cursor,limit,cid,actor_uid,action,from_time,to_time` → 审计记录游标分页。 |
| `GET /notification_preferences`、`PUT /notification_preferences/server`、`PUT /channels/{cid}/notification_preference` | 读取服务端及频道偏好。写入通知模式与静音期。 |
| `GET /files/list`、`GET /files/uploaders` | 文件列表查询 `search,mime_prefix,offset,limit,sort_by,sort_order,uploader_id,date_from,date_to`。上传者列表无查询参数。两者返回 `{items}`。 |
| `POST /files/delete`、`POST /files/batch-delete` | 分别发送 `{file_id,share_key}` 或 `{file_ids}`，忽略响应体。 |
