# 插件 Manifest 规范（草案）

本文定义客户端/服务端插件的最小元数据字段，用于目录展示、安装、权限提示与契约发现。

## 1. 基本字段（P0）
- `plugin_id: string`（全局唯一）
- `name: string`
- `version: string`（SemVer）
- `min_host_version: string`（SemVer）
- `description?: string`
- `author?: string`
- `entry: string`（例如 `index.js`）
- `permissions: string[]`（粗粒度；仅声明“需要额外能力”的权限）
- `provides_domains: Array<{ domain: string; domain_version: string }>`

权限约定（P0）：
- `storage` 不需要声明：宿主默认提供“按 server_socket 隔离命名空间”的存储能力。
- `network/clipboard/notifications` 等需要声明，宿主才会注入对应 Host API。

## 2. Contract 交付（P0）
二选一：
- 内置：`contracts: Array<{ domain: string; domain_version: string; payload_schema: object; constraints?: object }>`
- 远程：`contract_refs: Array<{ domain: string; domain_version: string; schema_url: string; schema_sha256: string }>`

## 3. 下载信息（目录侧）
由服务器/仓库目录返回：
- `download.url`
- `download.sha256`

## 4. 兼容性与演进（待补齐）
- 依赖（dependencies）
- 破坏性变更策略（major bump + migration notes）
