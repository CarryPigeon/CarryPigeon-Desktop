# UI 文档索引（精简版）

版本：v2.3（2026-10-22）

## 现行方案

- 唯一维护方案：`docs/design/ui/solution-a-patchbay/README.md`
- 统一界面语言（无缝工作台）：`docs/design/ui/solution-a-patchbay/16-统一界面语言（无缝工作台）.md`

## 历史方案

- 已废弃（仅归档）：`docs/tmp/archive-ui-legacy-warm-glass/README.md`

## 使用建议

- 先看方案索引，再按“页面规格 → 组件规格 → 状态机”阅读。
- 工程落地前，优先核对 `09-前端实现清单.md` 与 `11-状态机与错误码映射.md`。
- 新增/修改界面样式前，先读 `16-统一界面语言（无缝工作台）.md`，复用
  `src/styles/_ui.scss` 与 `src/shared/ui`；主窗口页面使用 `cp-workspace`，登录/注册与浮层是例外。
