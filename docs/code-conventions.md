## 代码规范约定（CarryPigeon-Desktop）

本项目目标是“代码即文档”：阅读代码即可理解模块职责、数据流与边界条件。

### 1) 注释语言与粒度

- **注释统一使用中文**，包括：
  - 模块级（Rust：`//!`；TS/Vue：文件头 `@fileoverview`）
  - 文件级（每个文件必须有“职责 + 边界”说明）
  - 方法级（public 与关键 private helper 都要说明输入/输出/副作用）
  - 常量级（业务常量必须解释来源与用途）
- 不要求为“自解释”的简单 getter/setter 写长注释；但凡涉及**协议/存储/并发/状态机/副作用**，必须写清楚。

### 2) 日志语言与格式

- **日志输出统一使用英文**，便于：
  - 跨端（WebView/Rust）统一检索
  - 与第三方系统/SDK 日志对齐
  - 在用户侧收集日志时减少歧义
- 前端请使用 `src/shared/utils/logger.ts` 提供的 `createLogger(scope)` 或 `src/shared/tauri/tauriLog.ts`，不要直接调用 `console.*`。
- 前端日志 `message` 必须使用 `Action: <snake_case>`，并遵守二次分层（例如 `Action: chat_ws_resume_failed`）。
- Rust 请使用 `tracing` 系列宏（`info!` / `warn!` / `error!` / `debug!`），避免使用 `println!`（测试可例外）。
- Rust 日志必须包含结构化字段 `action = "..."`，并遵守二次分层前缀（如 `app_` / `network_` / `settings_`）。
- 提交前必须通过：`bash scripts/check-log-standards.sh` 与 `bash scripts/check-rust-standards.sh`。
- 词汇规范见：`docs/日志Action词汇表.md`。

### 3) 文档化注释（结构化）

- TS/JSDoc：导出的函数/类型优先使用结构化 JSDoc（`@param` / `@returns`），与 ESLint 规则保持一致。
- Rustdoc：优先使用 `# 参数` / `# 返回值` / `# 说明`，并保持中文描述清晰可落地。

### 4) 冗余代码清理原则

- 优先删除“重复实现同一语义”的代码（例如重复 refresh 编排、重复 localStorage key 字符串）。
- 若暂时无法删除（存在调用方/兼容性），必须在注释中说明“为何保留 + 何时可删”。



### 5) Tauri 命令统一标准（Rust）

- `#[tauri::command]` 返回值统一使用 `CommandResult<T>`（定义见 `src-tauri/src/shared/error/mod.rs`）。
- 命令错误统一为 `[ERROR_CODE] message` 格式，错误码使用大写下划线。
- 命令层（`di/commands`）负责做错误标准化映射：`map_err(|e| to_command_error("ERROR_CODE", e))`。
- 内部层（`usecases/data/shared`）优先使用 `anyhow::Result<T>`，避免传播 `Result<T, String>`。
- 详情见：`docs/Rust统一标准.md`。
