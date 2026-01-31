# 06｜页面规格：插件中心与 required 安装向导

> 说明：该方案已废弃，现行方案为 `docs/ui/方案A-插线板/文档索引.md`。

版本：v1.1  
日期：2026-01-31  
依据：PRD 7.1 / 5.6 + `design/client/PLUGIN-CENTER-FLOWS.md`

## 1. 插件中心（/plugins）

目标：
- 让“安装/启用/更新/回滚”的复杂状态机对用户可理解、可恢复。
- required 插件一眼可见，并且对“无法登录”的后果有明确提示。

### 1.1 页面结构（两栏）

- 左：过滤与来源
  - 搜索（name/plugin_id/domain）
  - Filter：All / Installed / Enabled / Updates / Required
  - Source：Server Catalog / Repo Catalog（默认优先 server）
- 右：插件列表（卡片）

卡片信息（P0 必须）：
- 名称、版本、简介、提供的 domains
- 标签：`required`、`update`、`failed`
- 状态：未安装 / 已安装未启用 / 已启用 / 启用失败
- 操作：安装 / 启用 / 禁用 / 更新 / 卸载 / 详情

### 1.2 详情页（/plugins/detail/:pluginId）

必须展示并可复制：
- `plugin_id`、版本、`min_host_version`
- permissions（新增权限高亮）
- 来源（server/repo）与 sha256
- domains 与 contracts（若有）
- 最近错误（status=failed）

### 1.3 关键交互（状态机映射）

安装（Install）：
- select_version → confirm → downloading → verifying_sha256 → unpacking → installed

启用（Enable）：
- enabling → enabled | failed（失败保留旧版本可回滚）

更新（Update）：
- 检查更新 → 用户确认（展示权限变化）→ 原子切换 → 失败回滚

> UI 上不要把“状态机”直接写出来，而是用“进度条 + 当前步骤标题 + 可展开错误详情”的方式表达。

## 2. required 安装向导（/required-setup）

触发：登录相关 API 命中 `required_plugin_missing`。

页面职责：
- 解释：为什么被阻止登录（是服务器的 required 约束，不是客户端坏了）
- 展示：缺失列表 `missing_plugins[]`
- 操作：`打开插件中心（Required 视图）`、`重试检查`、`更换服务器`

成功路径：
- required 列表全部 `enabled=true && status="ok"` → 自动跳回登录页，并在顶部提示“required 已满足”

失败路径：
- enable 失败：在向导中直接可见错误，并能“一键定位到插件详情页”

## 3. 视觉细节（避免“通用插件市场”）

- required 插件：用“邮戳”徽章（矩形圆角 + 斜纹/边框），文字：REQUIRED。
- 更新：用“邮票撕边”角标（右上角锯齿/虚线轮廓）。
- 错误：以“验讫失败”红戳呈现，但仍提供修复按钮（重试/回滚/换源）。
