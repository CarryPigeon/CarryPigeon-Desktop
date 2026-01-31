# Project Design Docs

本目录用于存放 CarryPigeon 的产品/协议/客户端插件等设计文档，并支持渐进式迭代。

## 入口
- 产品需求文档（PRD）：`design/PRD.md`

## 分区文档
- 客户端设计总览：`design/client/CLIENT-OVERVIEW.md`
- 客户端插件运行时：`design/client/PLUGIN-RUNTIME.md`
- 客户端插件 UI 扩展点：`design/client/PLUGIN-UI-EXTENSIONS.md`
- 客户端插件安装与更新：`design/client/PLUGIN-INSTALL-UPDATE.md`
- 客户端插件包结构与资源加载：`design/client/PLUGIN-PACKAGE-STRUCTURE.md`
- 客户端 app:// URL 规范：`design/client/APP-URL-SPEC.md`
- 插件资源引用实践（Vue）：`design/client/PLUGIN-ASSET-USAGE.md`
- 客户端插件中心流程：`design/client/PLUGIN-CENTER-FLOWS.md`
- 插件系统总览：`design/plugin/PLUGIN-SYSTEM.md`
- 插件 Manifest 规范：`design/plugin/PLUGIN-MANIFEST.md`
- 插件入口模块 API：`design/plugin/PLUGIN-ENTRY-API.md`
- 插件 Composer UI 规范：`design/plugin/PLUGIN-COMPOSER-UI.md`
- 协议总览：`design/protocol/PROTOCOL-OVERVIEW.md`
- 协议：插件目录与错误响应：`design/protocol/PLUGIN-CATALOG-AND-ERRORS.md`
- 消息 Domain 与契约：`design/protocol/MESSAGE-DOMAINS.md`
- 架构决策记录（ADR）：`design/decisions/ADR-0001-plugin-scope-and-gate.md`
- 架构决策记录（ADR）：`design/decisions/ADR-0002-client-plugin-runtime.md`
- 架构决策记录（ADR）：`design/decisions/ADR-0003-vue-sfc-runtime-compile.md`
- 架构决策记录（ADR）：`design/decisions/ADR-0004-plugin-artifacts-only.md`

## 约定（渐进式）
- 每份文档都允许从“草案”开始；新增字段/规则必须写清：动机、影响面、迁移策略。
- 所有“必须/禁止/推荐”用词要能落到验收用例或测试策略。
