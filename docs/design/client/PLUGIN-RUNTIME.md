# 客户端插件运行时（草案）

目标：定义插件如何被发现、下载、校验、加载、执行，以及如何与宿主通信。本文聚焦“客户端侧”。

## 1. 插件包形态（确定）
- 包：ESM（`index.js`）+ 静态资源
- 组件：Vue renderer + Vue composer
- 元数据：Manifest（见 `docs/design/plugin/PLUGIN-MANIFEST.md`）

## 2. 生命周期
建议宿主支持以下生命周期（最小 P0）：
- `install`：下载与校验（sha256）
- `enable`：加载并注册能力（domains、renderers、composers）
- `disable`：注销能力，释放资源
- `uninstall`：移除本地文件与缓存

（可选 P1）：
- `onHostReady(context)`：宿主准备就绪回调
- `onServerChanged(server_socket)`：切换服务器回调

## 3. 加载与执行模型（当前决策）

### 3.1 v1：同进程 ESM 加载（P0，已确定）
- 宿主使用动态 import 加载插件入口模块（ESM）。
- 宿主向插件注入“受限 Host API”（按权限裁剪）。
- 插件提供 Vue renderer/composer 组件，宿主以内嵌方式渲染。

说明：
- 该模型以“实现效率与生态表达力优先”；并不等价于强安全沙箱。
- 后续如需更强隔离，可演进到 v2（见 3.2），但不应破坏既有 manifest/contract 语义。

### 3.2 v2：沙箱执行（规划，不作为 P0）
候选方案：
- `iframe sandbox`：插件 UI 在 iframe 内渲染；宿主通过 postMessage 与插件交互。
- `Worker`：插件逻辑在 Worker；UI 仍由宿主渲染（插件提供 schema/渲染描述，而非直接 Vue 组件）。

## 4. 依赖与版本
- 插件按 `server_id` 隔离安装（同一客户端连接不同服务器互不影响）。
- 同一 `plugin_id` 在不同服务器可为不同版本。
- 插件与宿主版本兼容通过 `min_host_version` 控制。

## 4.1 可直接执行（P0，已确定）

插件包安装后必须可直接执行，宿主不提供二次编译能力（不编译 `.vue`/TS/样式预处理等）。

要求：
- 插件入口 `entry` 必须指向可被 `import()` 的 ESM `*.js`/`*.mjs`（例如 `dist/index.js`）。
- 插件不得依赖宿主对非 JS/CSS 资源进行编译转换（例如 `import "./X.vue"`、`import "./x.ts"`、`import "./a.scss"` 均不允许）。
- 插件作者若使用 Vue SFC/TypeScript/预处理样式，需在发布前输出可执行 JS/CSS。

## 5. Host API 注入（粗粒度权限 + 最小能力）
即使权限粗粒度，宿主仍应只注入必要 API。建议最小集合：
- `getContext()`
- `sendMessage(payload)`
- `storage`（P0，默认注入：按 server_id 命名空间隔离）
- `network`（已确定：仅允许访问当前 `server_socket` 对应地址；不得访问任意公网）

### 5.0 storage 默认可用（P0，已确定）
宿主必须默认提供受控的 `storage` 能力（无需插件声明权限），并满足：
- 命名空间按 `server_id` 隔离；
- 不允许跨服务器读取/写入；
-（可选）配额与清理策略由宿主控制。

### 5.1 network 权限边界（P0，已确定）
若插件声明 `network` 权限，宿主的网络能力必须满足：
- 仅允许访问“当前 server_socket”对应的主机/端口（及其明确的 HTTP 文件/插件下载端点）。
- 禁止跨服务器访问（例如插件在 A 服务器上下文中访问 B 服务器）。
- 禁止访问任意公网（除非后续版本引入更细粒度白名单与用户授权）。

实现建议（不限制具体技术）：
- 宿主只提供一个受控的 `host.network.fetch()`，内部做 allowlist 校验；
- 不直接把原生 `fetch` 或不受控的 HTTP 能力暴露给插件。

## 6. required gate（客户端行为）
- 连接服务器后，若发现 required 插件未满足：
  - 允许：查看服务器信息、打开插件中心、下载/安装/启用 required 插件
  - 禁止：进入登录流程
