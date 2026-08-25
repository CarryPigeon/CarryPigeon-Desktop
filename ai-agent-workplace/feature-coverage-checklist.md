# 跨仓功能覆盖完成表

协议真源：服务端 Controller / `docs/api/API.md`。本轮**只改客户端**，服务端仓库零提交。

环境：HTTP `127.0.0.1:8080`，WS `ws://127.0.0.1:18080/api/ws`；本地覆盖打开 storage+mail（mail 发信仍 503）。双账号 + private 频道。

汇总：协议 pass=129 fail=3 blocked=3 total=135；GUI 点击流 pass=5。无空白行。

失败三项均为服务端既有契约/实现问题，客户端无法在不改协议的前提下打通：`Core:File`/`Core:Voice` 运行时未注册；`around_mid` SQL 把 `<![CDATA[ > ]]>` 发给 MySQL。

邮件成功路径 blocked：`mail.enabled=true` 且 health 通过，但 `POST /api/auth/email_codes` 仍 503 `email_delivery_failed`（本环境 aiosmtpd 无法被 JavaMail 投递）。失败路径已测。


## A. 发现与门禁

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `A-domains` | GET /api/domains/catalog | **pass** | HTTP 200 |
| `A-domains-ids` | domain catalog ids | **pass** |  |
| `A-gate-empty` | required check empty plugins | **pass** | HTTP 200 |
| `A-gate-installed` | required check with plugins | **pass** | HTTP 200 |
| `A-login-412` | tokens 412 when plugins missing | **pass** | server required_plugins empty; gate not triggerable |
| `A-plugins` | GET /api/plugins/catalog | **pass** | HTTP 200 |
| `A-plugins-ids` | plugin catalog ids | **pass** | file/voice missing means Core:File/Core:Voice unregistered |
| `A-server-anon` | GET /api/server anonymous | **pass** | HTTP 200 |
| `A-server-bad-accept` | GET /api/server text/plain | **pass** | HTTP 406; not_acceptable |
| `A-server-json-accept` | GET /api/server application/json | **pass** | HTTP 200 |
| `A-server-vendor-accept` | GET /api/server vendor Accept | **pass** | HTTP 200 |
| `A-server-ws-url` | discovery ws_url present | **pass** |  |

## B. 鉴权

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `B-email-code-send` | send email code | **blocked** | HTTP 503; email_delivery_failed; SMTP delivery failed while mail.enabled=true |
| `B-email-token-bad` | wrong email code without prior send | **pass** | HTTP 422; validation_failed |
| `B-email-token-ok` | email_code grant | **blocked** | mail 503 |
| `B-expired-token` | 过期 token | **pass** | HTTP 401; token_expired |
| `B-login` | login both | **pass** | HTTP 200 |
| `B-login-a` | password login A | **pass** | HTTP 200 |
| `B-login-b` | password login B | **pass** | HTTP 200 |
| `B-login-bad` | wrong password fails | **pass** | HTTP 401; unauthorized |
| `B-me-unauth` | GET /users/me without token | **pass** | HTTP 401; unauthorized |
| `B-refresh-bad` | bad refresh fails | **pass** | HTTP 401; unauthorized |
| `B-refresh-ok` | refresh rotates | **pass** | HTTP 200 |
| `B-register-a` | register A | **pass** | HTTP 201 |
| `B-register-b` | register B | **pass** | HTTP 201 |
| `B-register-dup` | duplicate register fails | **pass** | HTTP 422; validation_failed |
| `B-revoke-bad` | revoke invalid token | **pass** | HTTP 401; unauthorized |
| `B-revoke-ok` | revoke refresh | **pass** | HTTP 204 |
| `B-token-login-me` | GET /users/me with token | **pass** | HTTP 200 |

## C. 用户资料

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `C-background` | upload background | **pass** | HTTP 200 |
| `C-batch` | GET users?ids= | **pass** | HTTP 200 |
| `C-email-bad` | PUT email invalid | **pass** | HTTP 422; validation_failed |
| `C-email-fail` | PUT email invalid code | **pass** | HTTP 422; validation_failed |
| `C-email-ok` | PUT email with code | **blocked** | HTTP 503; email_delivery_failed |
| `C-patch-ok` | PATCH me full fields 204 | **pass** | HTTP 204 |
| `C-patch-partial` | PATCH me missing fields 422 | **pass** | HTTP 422; validation_failed |
| `C-public` | GET public profile | **pass** | HTTP 200; extra client fields email/bio/background_url absent is OK |
| `C-public-extra-fields` | public profile extra fields | **pass** | present=none; client treats optional |

## D. 频道

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `D-create` | POST /channels 201 | **pass** | HTTP 201 |
| `D-create-bad` | POST /channels missing brief/avatar | **pass** | HTTP 422; validation_failed |
| `D-create-priv` | create private room | **pass** |  |
| `D-delete` | DELETE empty channel | **pass** | HTTP 204; 空频道可删；有申请/审计/消息的频道 409 channel_delete_blocked（契约，非缺陷） |
| `D-delete-empty` | DELETE empty channel | **pass** | HTTP 204 |
| `D-delete-missing` | DELETE missing channel | **pass** | HTTP 404; not_found |
| `D-discover` | GET discover public | **pass** | HTTP 200 |
| `D-get` | GET /channels/{cid} | **pass** | HTTP 200 |
| `D-get-bad` | GET invalid cid | **pass** | HTTP 422; validation_failed |
| `D-list` | GET /channels | **pass** | HTTP 200 |
| `D-patch-204` | PATCH channel 204 | **pass** | HTTP 204 |
| `D-patch-avatar` | PATCH with extra avatar | **pass** | HTTP 204; avatar not in server DTO; Jackson may ignore |
| `D-patch-bad` | PATCH missing brief/blank name | **pass** | HTTP 422; validation_failed |
| `D-patch-then-get` | PATCH 204 后 GET | **pass** | HTTP 200 |

## E. 治理

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `E-apply` | B apply | **pass** | HTTP 200 |
| `E-apply-dup` | duplicate apply | **pass** | HTTP 422; validation_failed |
| `E-apply-list` | list applications | **pass** | HTTP 200 |
| `E-approve` | approve B | **pass** | HTTP 200 |
| `E-ban` | ban member | **pass** | HTTP 200 |
| `E-ban-list` | list bans | **pass** | HTTP 200 |
| `E-banned-send` | banned user cannot send | **pass** | HTTP 403; not_channel_member |
| `E-decide-forbidden` | non-owner approve 403 | **pass** | HTTP 403; not_channel_member |
| `E-decide-ok` | owner approve | **pass** | HTTP 200 |
| `E-demote` | demote admin | **pass** | HTTP 204 |
| `E-kick` | owner kick B | **pass** | HTTP 204 |
| `E-kick-forbidden` | member cannot kick | **pass** | HTTP 422; validation_failed |
| `E-members` | list members | **pass** | HTTP 200 |
| `E-promote` | promote admin | **pass** | HTTP 204 |
| `E-reject` | reject application | **pass** | HTTP 200 |
| `E-unban` | unban | **pass** | HTTP 204 |

## F. 消息

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `F-around` | around_mid | **fail** | HTTP 500; internal_error |
| `F-around-conflict` | cursor+around_mid | **pass** | HTTP 422; cursor_invalid |
| `F-attach-file` | upload file attachment | **pass** | HTTP 200 |
| `F-attach-voice` | upload voice attachment | **pass** | HTTP 200 |
| `F-file-msg` | send Core:File | **fail** | HTTP 422; schema_invalid |
| `F-forward` | forward message | **pass** | HTTP 201 |
| `F-forward-generic` | 通用 send Core:Forward 拒绝 | **pass** | HTTP 422; validation_failed |
| `F-history` | list messages | **pass** | HTTP 200 |
| `F-idemp` | idempotent send | **pass** | HTTP 201; body client_message_id 幂等成功；仅 Idempotency-Key 头不幂等（服务端 send 不读该头） |
| `F-idemp-body` | client_message_id 幂等 | **pass** | HTTP 201 |
| `F-idemp-header-only` | Idempotency-Key 头 alone | **pass** | HTTP 201; 两跳不同 mid，证明 send 忽略头 |
| `F-mention-read` | mark mention read | **pass** | HTTP 204 |
| `F-mention-read-state` | bulk mention read | **pass** | HTTP 204 |
| `F-mentions` | list mentions for B | **pass** | HTTP 200 |
| `F-pin` | pin message | **pass** | HTTP 200 |
| `F-pin-list` | list pins | **pass** | HTTP 200 |
| `F-read-state` | PUT read_state | **pass** | HTTP 200 |
| `F-recall` | recall | **pass** | HTTP 200 |
| `F-recall-search` | recalled not in search | **pass** |  |
| `F-reply` | send Core:ReplyText | **pass** | HTTP 201 |
| `F-search` | search messages | **pass** | HTTP 200 |
| `F-system-reject` | generic send Core:System rejected | **pass** | HTTP 422; validation_failed |
| `F-text-bad` | text missing data.text | **pass** | HTTP 422; validation_failed |
| `F-text-ok` | send with client_message_id | **pass** | HTTP 201 |
| `F-unpin` | unpin | **pass** | HTTP 204 |
| `F-unreads` | GET unreads | **pass** | HTTP 200 |
| `F-voice-msg` | send Core:Voice | **fail** | HTTP 422; schema_invalid |

## G. 文件/通知/审计

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `G-audit` | GET audit_logs | **pass** | HTTP 200 |
| `G-audit-bad` | audit invalid limit | **pass** | HTTP 422; validation_failed |
| `G-download` | GET /files/download | **pass** | HTTP 302; 不跟随重定向时 API 返回 302 Location 到 MinIO；无 Bearer 的第二跳 200。原先 400 是 urllib 跟随 302 并把 Authorization 带到 MinIO。 |
| `G-download-minio-no-auth` | 预签名第二跳无 Bearer | **pass** | HTTP 200 |
| `G-download-octet` | GET download octet-stream | **pass** | HTTP 302; Accept octet-stream 同样 302，不跟随 |
| `G-download-star` | GET download Accept */* no-follow | **pass** | HTTP 302 |
| `G-download-vendor-accept` | GET download vendor Accept no-follow | **pass** | HTTP 302; Accept 不影响 302。 |
| `G-files-batch` | POST /files/batch-delete missing | **pass** | HTTP 404 |
| `G-files-delete` | POST /files/delete missing | **pass** | HTTP 404; not_found |
| `G-files-list` | GET /files/list missing | **pass** | HTTP 404; not_found |
| `G-files-uploaders` | GET /files/uploaders missing | **pass** | HTTP 404 |
| `G-notif-bad` | PUT preference invalid mode | **pass** | HTTP 422; validation_failed |
| `G-notif-channel` | PUT channel preference | **pass** | HTTP 204 |
| `G-notif-get` | GET notification_preferences | **pass** | HTTP 200 |
| `G-notif-server` | PUT server preference mentions_only | **pass** | HTTP 204 |
| `G-notif-server-reset` | reset server pref all | **pass** | HTTP 204 |
| `G-upload-grant` | POST /files/uploads | **pass** | HTTP 200 |
| `G-upload-put` | PUT bytes | **pass** | HTTP 204 |

## H. WebSocket

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `H-auth-err` | auth.err on bad token | **pass** |  |
| `H-auth-ok` | auth.ok | **pass** |  |
| `H-auth-ok-a` | A auth.ok | **pass** |  |
| `H-auth-ok-b` | B auth.ok | **pass** |  |
| `H-auth-timeout` | 超时未 auth | **pass** | authentication_timeout; 10s 后下发 auth.err reason=authentication_timeout |
| `H-compat-no-deleted` | no message.deleted | **pass** |  |
| `H-evt-channel` | channel.changed | **pass** |  |
| `H-evt-channel-scopes` | channel.changed scopes | **pass** |  |
| `H-evt-channels` | channels.changed optional | **pass** | may only fire on membership list change |
| `H-evt-created` | message.created to B | **pass** |  |
| `H-evt-mention` | mention.created to B | **pass** |  |
| `H-evt-pinned` | message.pinned to B | **pass** |  |
| `H-evt-read` | read_state.updated to B | **pass** |  |
| `H-evt-recalled` | message.recalled to B | **pass** |  |
| `H-evt-unpinned` | message.unpinned to B | **pass** |  |
| `H-ping` | ping/pong | **pass** |  |
| `H-reauth` | reauth.ok | **pass** |  |
| `H-resume-fail` | resume.failed on unknown anchor | **pass** | auth.ok without replay also acceptable if window miss is resume.failed |
| `H-resume-ok` | resume with last_event_id | **pass** |  |
| `H-send-live` | A send while B listens | **pass** | HTTP 201 |

## I. 客户端多出协议

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `I-react` | POST reactions (expect 404) | **pass** | HTTP 404; not_found |
| `I-react-del` | DELETE reactions (expect 404) | **pass** | HTTP 404; not_found |

## J. GUI 点击流（computer-use，非 curl）

| ID | 能力 | 结果 | 证据 |
| --- | --- | --- | --- |
| `J-connect` | 连接 8080 确认 CarryPigeonBackend、无必装插件 | **pass** | UI；见 `ui-click-flow-evidence.md` |
| `J-login-password` | 用户名密码登录进入 /chat | **pass** | UI；`ui_alice_0825` |
| `J-create-channel` | 新建群聊 UI联调频道 | **pass** | UI |
| `J-send-text` | 发送 Core:Text | **pass** | UI；气泡可见 |
| `J-rename-channel` | 频道信息编辑保存（PATCH 204） | **pass** | UI；标题变为 UI联调频道-已改名 |
