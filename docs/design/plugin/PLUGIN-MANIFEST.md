# 插件 Manifest 规范（精简版）

> 目标：定义插件最小元数据，用于目录展示、安装校验、权限提示与契约发现。

## 1. 基本字段（P0）

- `plugin_id: string`（全局唯一）
- `name: string`
- `version: string`（SemVer）
- `min_host_version: string`（SemVer）
- `entry: string`（例如 `dist/index.js`）
- `permissions: string[]`
- `provides_domains: Array<{ domain: string; domain_version: string }>`
- `description?: string`
- `author?: string`
- `entry_api_version?: number`：入口 API 版本。`2` = Cordis 契约（`apply(ctx)`）；缺省/`1` = 传统契约
  （`activate/deactivate` + 静态 `renderers/composers`）。
- `ipc_prefixes?: string[]`：`invoke` / `onEvent` 允许的命令/事件前缀（如 `voice_call:`）。
  缺省为空表示不授予 IPC 能力。**该字段以已校验的 `plugin.json` 为权威来源**；插件 JS 模块中的
  同名声明不会被采用。前端还会与宿主「可暴露命名空间」白名单求交，拒绝 `*` 等过宽前缀。

## 2. 权限口径（P0）

- `storage` 不需要声明：宿主默认提供按 `server_id` 隔离的存储能力。
- `network/clipboard/notifications` 等能力需显式声明。
- `invoke` / `events`：分别门控 `ctx.ipc.invoke` / `ctx.ipc.onEvent`；命令与事件均受
  `ipc_prefixes`（清单）+ 宿主可暴露命名空间白名单双重约束。
- `ai`：使用客户端自配 AI provider（OpenAI 兼容）生成总结。属高危权限，
  安装/更新时需用户显式确认；密钥由宿主代持，插件只能调用
  `host.ai.summarize()`，无法读取密钥或传入任意提示词。
  详见 `docs/design/client/PLUGIN-RUNTIME.md` §5.2。
- `messages:read`：读取**当前频道**已载入的消息（供 AI 总结等面板型插件使用）。属高危权限，
  安装/更新时需用户显式确认；宿主只提供 `host.messages.readCurrentChannel()` 与
  `host.messages.loadMoreHistory()`，不接受任意 channelId，单次最多 500 条，
  且插件不得持久化消息正文。详见 `docs/design/client/PLUGIN-RUNTIME.md` §5.3。

## 3. Contract 交付（P0）

二选一：
- 内置：`contracts[]`
- 引用：`contract_refs[]`（包含 `schema_url` + `schema_sha256`）

## 4. 目录侧下载信息

由目录接口提供：
- `download.url`
- `download.sha256`

## 5. 关联文档

- 入口导出：`docs/design/plugin/PLUGIN-ENTRY-API.md`
- 运行时：`docs/design/client/PLUGIN-RUNTIME.md`
- 包结构：`docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- Cordis 迁移方案：`docs/design/plugin/CORDIS-MIGRATION.md`
