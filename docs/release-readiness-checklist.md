# 发布准备状态检查清单

## 当前版本: 0.6.0

发布日期：2026-10-03

> 上一版（0.4.0）清单见本文件历史提交。本次为插件运行时 Cordis 重构版本，清单已按 0.6.0 实际状态重写。

## 版本号一致性

| 文件 | 字段 | 值 |
| --- | --- | --- |
| `package.json` | `version` | 0.6.0 |
| `src-tauri/Cargo.toml` | `package.version` | 0.6.0 |
| `src-tauri/tauri.conf.json` | `version` | 0.6.0 |
| `Cargo.lock` | `carrypigeon-desktop.version` | 0.6.0 |

- ⚠️ **本次修复**：`tauri.conf.json` 此前长期停留于 `0.4.0`。CI 的 `tauri-action` 用 `tagName: v__VERSION__`，而 `__VERSION__` 取自该文件，未对齐会把本次发布打成 `v0.4.0` 标签。现已三处对齐，`Cargo.lock` 由 `cargo metadata` 刷新。

## 质量门禁（本次实测）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 前端 lint | `pnpm run lint` | ✅ 通过（Windows 跳过 3 个 bash 检查） |
| feature 边界 | `bash scripts/check-feature-boundaries.sh` | ✅ 通过 |
| Rust 规范 | `bash scripts/check-rust-standards.sh` | ✅ 7/7 通过（含 rustfmt） |
| 日志规范 | `bash scripts/check-log-standards.sh` | ✅ 3/3 通过 |
| 类型检查 | `pnpm run typecheck` | ✅ 通过 |
| 前端测试 | `pnpm test` | ✅ 83 suites / 654 tests |
| 前端构建 | `pnpm run build` | ✅ 通过（含 vendor + 5 插件 prebuild） |
| Rust 测试 | `cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1` | ✅ 217 passed / 2 ignored / 0 failed |
| 依赖漏洞 | `cargo audit`（CI 原命令） | ✅ exit 0 |
| 依赖合规 | `cargo deny check` | ✅ advisories / bans / licenses / sources ok |

### 本阶段修复的发布阻塞项

1. **`tauri.conf.json` 版本漂移**（`0.4.0` → `0.6.0`）：会导致 CI 生成错误 tag。
2. **wasmtime 3 条新的 RUSTSEC 公告**：48.0.3 命中 RUSTSEC-2026-0325 / 0326 / 0327，`cargo deny check` 失败，且 CI 的 `cargo audit` 忽略列表不含这 3 条 → CI 必红。已升级到 **48.0.5**（修复区间 `>=48.0.4,<49.0.0`），未新增 ignore。
3. **`CHANGELOG.md` 缺失 v0.5.0 条目**（该版本已打标签但未记录）：已按 `v0.4.0..v0.5.0` 提交补记，并新增 0.6.0 条目。

## 功能完整性

### 0.6.0 新增 / 变更

- ✅ 插件运行时 Cordis 重构：`runtime/**` + `sdk/` 新增，旧 `pluginScope` / `hostApiFactory` / `domainRegistryContext` / `domainRegistryBindings` / `pluginUiApi` / `pluginInvokeApi` / `pluginEventApi` 删除
- ✅ 插件入口契约 v2（`apply` / `inject` / `ctx.domains` / `ctx.ui` / `ctx.ipc` / `ctx.storage` / `ctx.network` / `ctx.ai` / `ctx.messages`）
- ✅ v1 legacy adapter（`entryApiVersion` 缺省 = 1，兼容旧 `PluginContext` 全字段）
- ✅ 权限 = 服务可见性；`assertRequiredPermissions` + `markFailed`
- ✅ IPC 白名单 manifest 声明（`ipcPrefixes`）+ 宿主命名空间双重约束
- ✅ Cordis 单实例（`src/cordis-entry.ts` → `public/vendor/cordis.mjs` + importmap + 插件 alias）
- ✅ 五个内置插件迁移 v2（markdown / theme / group-notice / ai-summary / voice-call）
- ✅ 频道置顶（本地 `channel-pins.json` + 文件热加载事件 + 5 个 Tauri 命令）
- ✅ 客户端可替换 AI 服务（7 种来源、密钥凭据管理器单向存取、模型列表拉取）
- ✅ AI 摘要插件增强（范围选择 + `chatPluginMessagesBridge` / `channelMessageProjection`）
- ✅ 消息引用跳转（右键 + 引用块按钮，虚拟列表定位高亮）
- ✅ theme 插件改为宿主主题薄代理

### 沿用的既有能力（回归范围）

- ✅ 用户认证与登录、会话恢复、多服务器管理
- ✅ 聊天消息收发（文本 / 图片 / 视频 / 文件）、引用回复、转发、撤回、编辑、多选批量
- ✅ 文件上传下载（多选、拖拽、预览、流式 IO）
- ✅ 语音 / 视频通话、屏幕共享、设备热插拔
- ✅ 截图工具（全屏捕获、标注、叠加窗口）
- ✅ 搜索、通知中心、频道通知级别、全局 DND、托盘
- ✅ 设置体系（主题 / 语言 / 关闭到托盘 / 诊断模式 / 导入导出 / 重置）
- ✅ 安全聊天缓存（AES-GCM）、插件包校验（SHA256 / 同源 / TLS fingerprint）、wasmtime 沙箱

## 架构与规范

- ✅ Feature-first + Clean Layers；跨 feature 仅经 `api.ts` / `api-types`
- ✅ Cordis import 未越出 plugins feature 边界（`check-feature-boundaries.sh` 通过）
- ✅ 所有 `#[tauri::command]` 返回 `CommandResult<T>`；新增命令已在 `app/mod.rs` 的 `invoke_handler!` 注册
- ✅ Rust 生产代码无 `unwrap` / `expect` / `panic!` / `todo!`（规范脚本通过）
- ✅ 日志：英文 + Action 词汇表（规范脚本通过）
- ✅ 注释中文

## 文档

- ✅ `CHANGELOG.md`：新增 0.6.0、补记 0.5.0
- ✅ `docs/v0.6.0-release-notes.md`：发布说明（含破坏性变更、验证结果、冒烟清单）
- ✅ `docs/design/plugin/CORDIS-MIGRATION.md`：重构方案与落地清单
- ✅ `docs/design/plugin/PLUGIN-ENTRY-API.md` / `PLUGIN-MANIFEST.md` / `README.md`：契约与清单同步
- ✅ `docs/design/client/PLUGIN-RUNTIME.md`：生命周期 / 权限 / 服务同步
- ✅ `docs/release-readiness-checklist.md`（本文件）

## 未在本机执行、由 CI 覆盖

- ⏳ 安装包 bundling（`.msi` / `.dmg` / `.deb` / `.AppImage`）：CI 跨平台矩阵产出，本机不下载 WiX / NSIS。
- ⏳ `cargo audit` / `cargo deny check` 的 Linux 环境复跑：本机已通过，CI 将复跑。
- ⏳ 真机端到端冒烟：按 `docs/v0.6.0-release-notes.md` 的冒烟清单执行。

## 发布步骤

```bash
# 1) 确认工作区干净、门禁全绿（见上表）
pnpm run lint && pnpm run build && pnpm test
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
cargo audit --ignore RUSTSEC-2023-0071 --ignore RUSTSEC-2026-0194 --ignore RUSTSEC-2026-0195 --ignore RUSTSEC-2026-0235
cargo deny check

# 2) 提交并打 tag
git commit -m "chore(release): v0.6.0"
git tag -a v0.6.0 -m "Release v0.6.0"

# 3) 推送（需 GitHub 权限）
git push origin master
git push origin v0.6.0

# 4) 创建 draft release
gh release create v0.6.0 --draft --title "CarryPigeon Desktop v0.6.0" --notes-file docs/v0.6.0-release-notes.md
```

## 发布建议

**可发布**：功能完整、门禁全绿、安全公告清零、版本号三处对齐、文档同步。

**唯一遗留风险**：插件运行时为“一次性切换”（无运行时开关），legacy adapter 是 v1 兼容的唯一保障。建议按冒烟清单第 3–5 项重点回归插件加载、禁用、v1 兼容与权限门控。
