# UI 点击流联调证据（computer-use）

约束：只改客户端；本文件只记录 Vite `:1420` × 真服 HTTP `:8080` / WS `:18080` 的 GUI 点击。服务端仓库零提交。

环境：账号 `ui_alice_0825`；Vite `cp-vite-dev`；Chrome `http://127.0.0.1:1420`。computer-use：`bc-a9260249-ed4f-5738-8a9c-33c57f33a6ad`（打开登录页）、`bc-fcb08596-1b06-5d36-8296-d931b728d5b9`（A–F 点击流，全部成功）。

走查录像（精修 92.3s，含光标）：`/opt/cursor/artifacts/ui_clickflow_login_create_channel_send_rename.mp4`。抽帧复核不是空白/失败片：连接、登录、建频道、发消息、改名均出现且最终态正确。

## 点击步骤与结果

| 段 | 操作 | 结果 | 录像约时 | 截图 |
| --- | --- | --- | --- | --- |
| A | 地址栏填 `http://127.0.0.1:8080` → 连接 | **pass**。确认页 `CarryPigeonBackend` / `1.0` / “该服务器没有必须插件。” | 0–10s | `ui_login_connected_carrypigeon_backend.png` |
| B | 「下一步：登录」→ 切到「用户名密码」 | **pass**。用户名/密码框可见 | ~15s | （录像） |
| C | 用户名 `ui_alice_0825`、密码 `UiPass123!` → 登录 | **pass**。进入 `/chat`，三栏布局，绿点 SERVER，频道 `public`/`system` | ~25–35s（含 Chrome「保存密码」点「No thanks」） | （录像） |
| D | 「+」→「新建群聊」→ 名称 `UI联调频道`、简介 `computer-use joint debug` → 确认 | **pass**。列表选中该频道 | ~45–55s | （录像） |
| E | 输入 `UI点击流联调：文本消息` → 发送 | **pass**。气泡 `UI_ALICE_0825` / `Core:Text` / 03:12 AM | ~65s | `ui_chat_message_sent.png` |
| F | 频道行信息 → 编辑 → 名称 `UI联调频道-已改名` → 保存 → 关对话框 | **pass**。列表与顶栏均为改名后标题；PATCH 204 路径未再空引用 | ~78–90s | `ui_channel_renamed.png` |

## 结论

- GUI 主路径（连接、密码登录、建群、发文本、改名）**全部 pass**。
- 本轮 **未发现新的客户端 adapter bug**，无额外代码提交。
- 未在 UI 上覆盖协议清单里的服务端残留：`Core:File`/`Core:Voice`、`around_mid`、邮件成功路径。

## 录像复核（代替 videoReview 子代理抽帧）

精修片跳过空闲等待，不是失败截断。关键帧：~2s 连接对话框；~8s 已填 `:8080`；~15s 用户名密码页；~32s 登录后聊天 + 浏览器存密提示；~45–52s 创建频道；~65s 正在输入待发文本；~78–80s 编辑名称；~90s 最终「UI联调频道-已改名」+ 已发消息。
