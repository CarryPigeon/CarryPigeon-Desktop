# 客户端插件安装与更新（精简版）

> 目标：定义安装与更新策略，不重复状态机细节。

## 1. 文档边界

- 本文档只定义策略与约束。
- 详细状态机见：`docs/design/client/PLUGIN-CENTER-FLOWS.md`。
- 包结构与目录见：`docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`。

## 2. 安装策略（P0）

- 来源：`Server Catalog`（必选）与 `Repo Catalog`（可选）。
- 前置：必须先拿到 `server_id`，作为安装与缓存隔离键。
- 校验：下载后必须执行 `sha256` 完整性校验。
- 产物：仅安装“可直接执行”的插件包（ESM + 静态资源）。
- 存储：按 `server_id/plugin_id/version` 分层保存，允许多版本并存。

## 3. 启用策略（P0）

- 安装完成后不强制自动启用（required 场景可引导立即启用）。
- 启用前校验 `min_host_version`。
- 启用失败必须可见错误，并保留旧版本可用状态。

## 4. 更新策略（P0）

- 流程：`check_update -> user_confirm -> download -> verify -> enable_new -> switch_current`。
- 必须原子切换：新版本启用成功后才切换 `current`。
- 失败必须回滚：任一步失败保持旧版本继续可用。
- 权限变化提示：若新版本新增敏感权限，必须显式提示用户确认。

## 5. 规划项（P1）

- 自动更新策略（按服务器/插件维度开关）
- 版本保留与清理策略（保留 N 个可回滚版本）
