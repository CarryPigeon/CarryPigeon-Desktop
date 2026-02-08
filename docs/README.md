# 文档总览（README）

> 目标：统一归档到 `docs/`，并按“长期规范 / 临时文档 / 设计 / API”四类管理。

## 目录分层（当前标准）

- `docs/`：长期规范文档（架构、规范、开发指南、运行指引）
- `docs/tmp/`：临时文档（待办、改进记录、修改矩阵、归档摘要）
- `docs/design/`：模块设计文档（PRD、client/plugin/protocol/ADR、UI 设计）
- `docs/api/`：API 介绍与协议规范

## 命名约定（摘要）

- 目录入口文件统一为 `README.md`。
- 临时文档统一 `kebab-case`（示例：`improvement-notes.md`）。
- 长期规范文档可使用中文主题名，但需语义清晰、避免重复。
- 详细规则见：`docs/文档规范.md`。

## 快速阅读路径（建议）

1. `docs/项目简介.md`
2. `docs/架构设计.md`
3. `docs/前端调试与Mock.md`
4. `docs/新Feature接入检查清单.md`

## 长期规范文档（docs 根目录）

- 架构与运行
  - `docs/架构设计.md`
  - `docs/客户端开发指南.md`
  - `docs/前端调试与Mock.md`
  - `docs/数据库使用指南.md`
- 工程规范
  - `docs/文档规范.md`
  - `docs/code-conventions.md`
  - `docs/日志与注释规范.md`
  - `docs/日志Action词汇表.md`
  - `docs/Rust统一标准.md`
  - `docs/前端嵌入式文档规范.md`

## 设计与 API 入口

- 设计入口：`docs/design/README.md`
- UI 设计入口：`docs/design/ui/README.md`
- API 入口：`docs/api/README.md`

## 临时文档入口

- 临时目录：`docs/tmp/README.md`
- 改进记录：`docs/tmp/improvement-notes.md`
- 落地矩阵：`docs/tmp/prd-api-migration-matrix-v1.1-v1.0.md`
- 历史归档摘要：`docs/tmp/archive-ui-legacy-warm-glass/README.md`

## 维护约定（简版）

- 新增规范性文档放 `docs/`；短期跟踪与过渡材料放 `docs/tmp/`。
- 模块设计一律放 `docs/design/`，避免散落在根目录。
- API 变更只在 `docs/api/` 维护，其他文档引用不拷贝。
- 同一规则保持单一真源，其余文档仅链接引用。
