# Rust 统一标准（Tauri 侧）

> 适用范围：`src-tauri/src/**`
>
> 目标：降低运行时崩溃风险、统一错误语义、提高日志可检索性与可观测性。

## 1. 命令返回统一

- 所有 `#[tauri::command]` 返回值统一使用：`CommandResult<T>`。
- `CommandResult<T>` 定义位于：`src-tauri/src/shared/error/mod.rs`。
- 当前阶段保持前端兼容：错误仍为字符串，但统一格式为：`[ERROR_CODE] message`。

### 示例

```rust
use crate::shared::error::{CommandResult, to_command_error};

#[tauri::command]
pub async fn example() -> CommandResult<()> {
    do_work().await.map_err(|e| to_command_error("EXAMPLE_FAILED", e))
}
```

## 2. 内部错误模型统一（非 command）

- `di/commands` 之外的层（`usecases` / `data` / `shared`）统一使用 `anyhow::Result<T>`。
- 禁止在内部层继续扩散 `Result<T, String>`。
- 在 `di/commands` 边界统一做 `to_command_error("ERROR_CODE", e)` 映射。

## 3. 错误码标准

- 错误码统一使用大写下划线，如：`NETWORK_TCP_SEND_FAILED`。
- 错误码应满足：
  - 同一 feature 下不同 command 不应共用兜底错误码（例如避免 `*_COMMAND_FAILED`），应使用逐命令错误码；
  - 稳定（不要频繁改名）；
  - 可定位（能看出 feature 和动作）；
  - 粒度适中（避免一个功能 20 个近似码）。

推荐命名模板：`<FEATURE>_<ACTION>_<FAILED|INVALID|NOT_FOUND>`。

## 4. 日志标准

- 使用 `tracing` 宏，不使用 `println!/eprintln!/dbg!`。
- 每条 `tracing` 日志必须包含结构化字段 `action`，并使用二次分层前缀（如 `app_` / `network_` / `settings_`），再补充关键业务维度（如 `server_socket`、`plugin_id`）。
- 错误日志统一经 `to_command_error()` 落盘（自动输出 `action = "tauri_command_failed"` 与 `code`）。

## 5. 禁止项

- 生产代码禁止：`unwrap()` / `expect()` / `panic!` / `todo!` / `unimplemented!`。
- `async fn` 中禁止阻塞式文件 IO（`std::fs::*`），统一使用 `tokio::fs::*`。

## 6. 分层约束

- `di/commands`：只做参数透传、错误标准化、最少量输入校验。
- `usecases`：编排业务流程，避免直接依赖 Tauri API。
- `data`：IO 与三方 SDK 细节，返回原始错误给上层映射。

## 7. 守门检查

新增脚本：`scripts/check-rust-standards.sh`

检查项：
- 禁止模式扫描（panic-prone + debug 输出）；
- `#[tauri::command]` 返回风格扫描（强制 `CommandResult<T>`）；
- 禁止裸 `Result<_, String>`（仅 `shared/error/mod.rs` 的类型别名允许）；
- 禁止通用插件错误码 `PLUGINS_COMMAND_FAILED`；
- `tracing` 日志强制包含 `action` 字段；
- `action` 强制满足二次分层前缀；
- `cargo fmt --all -- --check`。

执行方式：

```bash
npm run lint:rust:std
```

## 8. 增量迁移原则

- 新增/改动的 Tauri 命令必须满足本规范。
- 历史代码按“触达即迁移”策略推进，不强制一次性大改。
- 若存在兼容性阻碍，需在 PR 说明：
  - 当前阻碍点；
  - 临时方案；
  - 下一步迁移计划。
