# 客户端插件中心流程（状态机 + 交互）（草案）

范围：定义客户端“插件中心/安装向导”的可实现交互流程、状态机与错误处理。用于指导 PC 与移动端一致实现。

前置依赖：
- `server_id` 来源：`design/protocol/PROTOCOL-OVERVIEW.md`
- 插件目录与 required gate：`design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`
- 插件包结构与可执行性：`design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- 插件运行时：`design/client/PLUGIN-RUNTIME.md`

---

## 1. 入口与触发点（P0）

插件中心必须支持以下入口：
1) **服务器设置/详情页** → 打开该服务器的插件中心（以 `server_id` 为命名空间）。
2) **required gate 安装向导** → 直接跳转插件中心的“required”筛选视图。
3) **消息降级卡片** → 点击“一键安装插件”跳转插件中心并定位 `plugin_id`。

---

## 2. 前置条件：server_id（P0）

### 2.1 必要条件
插件中心在进行任何“安装/启用/更新”前必须已获取 `server_id`。

### 2.2 缺失处理
若服务器信息接口未返回 `server_id`：
- 插件中心仍可展示“功能不可用”的说明页；
- 禁用所有安装/更新/启用按钮；
- 给出明确提示：服务端版本不兼容（缺少 server_id）。

---

## 3. 数据模型（客户端视角）

### 3.1 本地安装状态（按 server_id 隔离）
每个 `plugin_id` 维护：
- `installedVersions[]`
- `currentVersion?`
- `enabled: boolean`
- `status: "ok" | "disabled" | "failed"`
- `lastError?`（enable 失败原因）
- `installedFrom: "server" | "repo"`

### 3.2 目录数据
- **Server Catalog**：服务器返回的插件列表（含 required_plugins、download 信息）。
- **Repo Catalog**：用户配置的仓库源聚合结果（可选来源）。

### 3.3 版本选择规则（P0）
- 若插件同时存在于 server catalog 与 repo catalog：
  - 默认优先 server catalog（更符合服务器侧生态/兼容性预期）。
  - 用户可在“来源”下拉中手动切换来源。

---

## 4. 页面结构建议（P0）

### 4.1 列表视图（Catalog List）
每个插件卡片至少展示：
- 名称、版本、简介、提供的 domains
- required 标识（若在 required_plugins 中）
- 状态：未安装 / 已安装未启用 / 已启用 / 启用失败 / 有更新
- 操作按钮：安装 / 启用 / 禁用 / 更新 / 卸载 / 查看详情

### 4.2 详情视图（Plugin Detail）
展示并允许用户确认：
- manifest 信息（plugin_id、版本、min_host_version）
- permissions（network/clipboard/notifications 等；storage 默认无需声明）
- 下载来源（server/repo）与 sha256
- 提供 domains 与 contracts（若有）
- 最近错误（若 status=failed）

---

## 5. 状态机（P0）

### 5.1 Catalog 加载
状态：
- `idle` → `loading` → `ready` | `error`

错误：
- 网络/超时 → `error`，允许重试。

### 5.2 安装（Install）

入口：
- 在列表点击“安装”
- required 向导自动定位并提示安装
- 消息降级卡片“一键安装”

状态（建议）：
- `select_version` → `confirm` → `downloading` → `verifying_sha256` → `unpacking` → `installed`

失败分支（全部需要可见错误信息 + 重试）：
- 下载失败：回到 `confirm`
- sha256 不匹配：标记失败并删除本次下载产物，回到 `confirm`
- 解压失败：删除本次解压目录，回到 `confirm`

安装完成后的策略：
- **不强制自动启用**（由产品决定；P0 建议：对 required 插件安装后引导“启用”）

### 5.3 启用（Enable）

状态：
- `enabling` → `enabled` | `failed`

启用流程（最小要求）：
1) 校验 `min_host_version` 满足
2) 从 `app://plugins/<server_id>/<plugin_id>/<version>/<entry>` 动态 `import()`
3) 读取导出：`manifest`、`renderers`、`composers`、`contracts`
4) 注册到宿主扩展点（按 domain）

失败处理：
- 任意一步失败 → `failed`，写入 `lastError`，并保持原先的 `currentVersion`（若之前已启用过，则保持旧版本继续可用）。

### 5.4 禁用（Disable）
状态：
- `disabling` → `disabled`

要求：
- 从宿主扩展点注销所有 domain 注册（renderer/composer/contracts）。

### 5.5 卸载（Uninstall）
要求：
- 若插件为 required：允许卸载，但必须二次确认并提示“卸载后将阻止登录该服务器”。
- 卸载后移除本地文件与安装记录。

---

## 6. 更新（Check Update → Confirm → Switch）（P0）

### 6.1 检查更新
- 入口：插件中心“检查更新”按钮；或插件详情页。
- 行为：对比 server catalog/repo catalog 的最新版本与本地 currentVersion。

### 6.2 用户确认更新
展示：
- 新旧版本号
- permissions 变化（若新增敏感权限需重点提示）
- 下载来源与 sha256

### 6.3 原子切换与回滚（必须）
策略（最小要求）：
1) 下载与安装新版本到新目录（不影响旧版本）
2) 对新版本执行 enable（以临时方式注册）
3) 若 enable 成功：更新 `currentVersion` 指向新版本
4) 若 enable 失败：自动回滚到旧版本（仍可用），并记录错误

---

## 7. required gate 联动（P0）

### 7.1 阻止登录点
当 required 未满足：
- 允许进入插件中心与安装流程
- 禁止进入登录（register/login/token-login）

### 7.2 满足条件
required 被认为“满足”的最小条件（建议）：
- required 列表中的每个 `plugin_id`：存在 `enabled=true` 且 `status="ok"`

---

## 8. 错误清单（P0）

插件中心需要对以下错误有明确 UI 提示与可恢复路径：
- 缺少 `server_id`（禁用插件能力）
- catalog 加载失败（重试）
- 下载失败（重试）
- sha256 不匹配（重试/换源）
- 解压失败（重试）
- `min_host_version` 不满足（提示升级宿主或选择旧版本）
- enable 失败（展示错误详情、允许重试、允许回滚/禁用）
- required 插件失败（提示“无法登录直到修复”）

---

## 9. P0 验收用例（补充）

1) required 插件缺失：进入安装向导 → 安装 → 启用成功 → 登录放行。  
2) 更新失败回滚：从 v1 更新到 v2，v2 enable 失败 → 自动回滚到 v1 且插件仍可用。  
3) sha256 不匹配：安装失败并提示，且不会污染已安装版本。  
4) 缺 server_id：插件中心不可用但核心聊天仍可用。  

