# Client 设计索引（精简版）

> 范围：客户端插件系统相关设计（安装、运行、资源、UI 扩展）。

## 推荐阅读顺序

1. `docs/design/client/CLIENT-OVERVIEW.md`
2. `docs/design/client/PLUGIN-RUNTIME.md`
3. `docs/design/client/PLUGIN-CENTER-FLOWS.md`
4. `docs/design/client/PLUGIN-PACKAGE-STRUCTURE.md`
5. `docs/design/client/APP-URL-SPEC.md`
6. `docs/design/client/PLUGIN-ASSET-USAGE.md`
7. `docs/design/client/PLUGIN-INSTALL-UPDATE.md`
8. `docs/design/client/PLUGIN-UI-EXTENSIONS.md`

## 真源分工（避免重复）

- 运行时与能力边界：`PLUGIN-RUNTIME.md`
- 插件中心状态机与交互：`PLUGIN-CENTER-FLOWS.md`
- 包结构与安装目录：`PLUGIN-PACKAGE-STRUCTURE.md`
- `app://` URL 规则：`APP-URL-SPEC.md`
- 资源引用最佳实践：`PLUGIN-ASSET-USAGE.md`
- 安装/更新策略：`PLUGIN-INSTALL-UPDATE.md`

## 维护约定

- “规则类定义”只在真源文档维护；其他文档以链接引用。
- 避免在多个文档重复定义 `server_id`、`entry`、`sha256`、回滚流程。
