# 任务单：HTTP/WS v1 UI 点击流联调（desktop）

状态：`done`  
作者：`ai`  
时间：`20260825-032300`  
任务短名：`ui-click-flow-joint-debug`

用户约束：**只能改客户端**。服务端仓库本轮零提交、零 PR。

## 任务目标

在协议联调（`20260825-024500-ai-client-server-joint-debug-done.md`）之后，用 computer-use 做 GUI 点击流，而不是只靠 curl/脚本。按 walkthrough-artifacts 产出屏幕录像与截图。

## 影响模块

- 正式代码：无（点击流未发现新 adapter 缺陷）
- 工作目录：`ai-agent-workplace/ui-click-flow-evidence.md` 及本文件
- 服务端：只读

## 允许 / 禁止

允许：本仓库 `ai-agent-workplace/`。禁止：服务端任何文件、对外协议、回写正式 `docs/`。

## 验收

- [x] 连接 `http://127.0.0.1:8080` → CarryPigeonBackend、无必装插件
- [x] 切换用户名密码并登录到 `/chat`
- [x] 新建群聊 `UI联调频道`
- [x] 发送文本 `UI点击流联调：文本消息`
- [x] 频道信息编辑保存为 `UI联调频道-已改名`（PATCH 204 客户端路径）
- [x] 走查录像 + 关键截图进 `/opt/cursor/artifacts/`
- [x] 点击步骤有 pass/fail 记录

## 实际结果

A–F 全部 **pass**。无新客户端代码变更。协议侧三项服务端 fail / 邮件 blocked 仍只记录在 `joint-debug-findings.md`。

## 变更审核清单自检

- 未改服务端；未改协议；未新增依赖
- 测试：GUI 点击流 + 既有 vitest（本轮未再改测试）
- 文档：仅 workplace，不回写 `docs/`
