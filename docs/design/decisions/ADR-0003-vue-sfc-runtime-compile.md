# ADR-0003：插件 `.vue` SFC 运行时编译

日期：2026-01-31  
状态：Superseded（被 ADR-0004 替代）

## 背景
插件生态希望允许插件包包含 `.vue` 源文件，以降低插件开发与分发门槛，并保持 PC/移动端一致的 UI 扩展能力。

## 决策
已废弃：插件包不再允许包含编译前源文件（`.vue`、`.ts`），宿主不提供运行时编译能力。

## 影响
请参考：`docs/design/decisions/ADR-0004-plugin-artifacts-only.md`。
