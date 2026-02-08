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

## 2. 权限口径（P0）

- `storage` 不需要声明：宿主默认提供按 `server_id` 隔离的存储能力。
- `network/clipboard/notifications` 等能力需显式声明。

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
