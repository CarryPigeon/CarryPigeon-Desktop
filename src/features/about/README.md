# about Feature

## 定位
应用关于页面 — 显示版本号、技术栈、许可信息、致谢名单。

## 边界
- 纯静态信息展示，不调用后端 API。
- 数据由 `api.ts` 内联提供。

## 入口
- `api.ts` — `getAboutCapabilities()`
- `routes.ts` — `AboutPage`（路由 `/about`）

## 数据来源
应用信息在 `api.ts` 中以常量定义，与 `package.json` version 保持一致。
