# Plugin 设计索引（精简版）

> 范围：插件包契约与宿主交互接口（manifest、entry、composer）。

## 推荐阅读顺序

1. `docs/design/plugin/PLUGIN-SYSTEM.md`
2. `docs/design/plugin/PLUGIN-MANIFEST.md`
3. `docs/design/plugin/PLUGIN-ENTRY-API.md`
4. `docs/design/plugin/PLUGIN-COMPOSER-UI.md`

## 真源分工（避免重复）

- 系统范围与流程：`PLUGIN-SYSTEM.md`
- 元数据契约：`PLUGIN-MANIFEST.md`
- 入口导出契约：`PLUGIN-ENTRY-API.md`
- 输入组件契约：`PLUGIN-COMPOSER-UI.md`

## 关联文档

- 客户端运行时：`docs/design/client/PLUGIN-RUNTIME.md`
- 协议与 required gate：`docs/design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`
