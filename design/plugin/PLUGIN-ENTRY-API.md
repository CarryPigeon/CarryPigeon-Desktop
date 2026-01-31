# 插件入口模块 API（ESM，草案）

范围：仅定义“客户端如何加载插件 ESM 并调用/渲染”的最小契约。插件包格式为 ESM + 静态资源。

## 1. 入口模块
- 插件包必须提供一个入口模块（默认 `index.js`，由 manifest `entry` 指定）。
- 入口模块必须为 ESM，可被宿主 `import()`。

资源加载约定：
- 插件入口与资源由宿主映射到 `app://plugins/<server_id>/<plugin_id>/<version>/...`（或等价协议），详见：
  - `design/client/PLUGIN-PACKAGE-STRUCTURE.md`
  - `design/client/APP-URL-SPEC.md`
  
约束（P0，已确定）：
- 插件包不包含编译前源文件（例如 `.vue`、`.ts`）；宿主不提供运行时编译能力。
- 入口模块仅应 import 构建后的 `*.js` 模块与静态资源（CSS/图片/字体等）。
 - 插件安装后必须可直接执行：宿主对插件不做二次编译/转译/模板编译。

## 2. 必须导出（P0）

### 2.1 `manifest`
插件必须导出 `manifest`，字段遵循 `design/plugin/PLUGIN-MANIFEST.md`。

### 2.2 `renderers`
插件可导出 `renderers`（对象）：
- key：`domain`（例如 `Math:Formula`）
- value：Vue 组件（用于渲染消息）

### 2.3 `composers`
插件可导出 `composers`（对象）：
- key：`domain`
- value：Vue 组件（用于输入消息）

说明：
- 若某 domain 仅需要渲染，不需要输入，可只提供 renderer。
- 若提供 composer，建议遵循 `design/plugin/PLUGIN-COMPOSER-UI.md` 的组件契约。

### 2.4 `contracts`（推荐，P0）
插件应导出 `contracts`（数组），用于让宿主与服务端对齐 domain 契约：
- `{ domain, domain_version, payload_schema, constraints? }`

## 3. 可选导出（P1）
- `activate(ctx)`：插件被启用时调用（可注册命令、初始化缓存等）
- `deactivate()`：插件被禁用/卸载前调用（释放资源）

其中 `ctx` 是宿主注入的受限上下文（仅包含被授权的 Host API）。

## 4. 兼容性约束
- 插件不得假设宿主暴露全局 `fetch`/不受控网络能力；网络能力仅可通过宿主注入 API 获取。
- 插件不得读取/写入跨 `server_socket` 的数据；宿主会按 server_socket 隔离 storage 命名空间。
 - 插件引用自身资源时应使用相对路径或 `new URL(rel, import.meta.url)`，不得硬编码宿主路径。

补充（生态约定）：
- 插件包不包含编译前源文件（如 `.vue`、`.ts`）；宿主不做运行时编译。
- 插件 CSS 允许影响宿主全局样式（可能产生风格冲突）。
