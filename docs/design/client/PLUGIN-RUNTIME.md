# 客户端插件运行时（草案）

> 运行时内核已重构为 **Cordis v3（`@cordisjs/core`）**：层级作用域、能力注入、权限门控、自动 dispose
> 均由 Cordis `Context` 承担；本文描述的生命周期/权限边界在该模型下的落地方式。
> 迁移背景、入口 v2 契约、权限 → 服务映射与兼容层，见 `docs/design/plugin/CORDIS-MIGRATION.md`。

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
- `network`（已确定：默认仅允许访问当前 `server_socket` 对应地址；`network:external` 权限可放行外部目标）
- `secrets`（已确定：密钥保管箱，系统凭据管理器代持、只写不读）

### 5.0 storage 默认可用（P0，已确定）
宿主必须默认提供受控的 `storage` 能力（无需插件声明权限），并满足：
- 命名空间按 `server_id` 隔离；
- 不允许跨服务器读取/写入；
-（可选）配额与清理策略由宿主控制。

### 5.1 network 权限边界（P0，已确定）
若插件声明 `network` 权限，宿主的网络能力必须满足：
- 默认仅允许访问“当前 server_socket”对应的主机/端口，也就是当前 server origin，同源下载端点包含在内。
- 禁止跨服务器访问（例如插件在 A 服务器上下文中访问 B 服务器）。
- 仅当 manifest 声明 `network:external` 权限时，才允许访问任意外部 http/https 目标
  （例如 OpenAI 兼容 provider、本地 Ollama）；该权限属高危，安装/更新时需用户显式确认。
  外源请求使用系统证书校验（不继承聊天服务器的自签 TLS 策略），重定向一律不跟随。

实现建议（不限制具体技术）：
- 宿主只提供一个受控的 `host.network.fetch()`，内部做 allowlist（同源 + 可选 `network:external`）校验；
- 不直接把原生 `fetch` 或不受控的 HTTP 能力暴露给插件；
- 请求头值支持 `@secret(<name>)` 引用：由宿主 Rust 侧从该插件的密钥保管箱解析替换，
  密钥明文不进入 WebView（引用缺失时请求失败，不静默发送空密钥）；
- 可选 `timeoutMs` 请求超时（宿主夹取到 [1000, 120000] 毫秒）。

### 5.2 secrets 权限边界（P0，已确定）
若插件声明 `secrets` 权限，宿主提供**密钥保管箱**能力，边界如下：
- 只暴露 `host.secrets.set(name, value)` / `host.secrets.status(name)` / `host.secrets.clear(name)`：
  `status` 只返回 `{ configured, secureStorageAvailable }`，任何接口都不返回密钥明文；
- 密钥写入系统凭据管理器（Windows 凭据管理器 / macOS Keychain / Secret Service），
  账户名按 `plugin-secret:{server_id}:{plugin_id}:{name}` 三段净化拼接——与 KV 存储同源的
  命名空间隔离，跨 server / 跨插件不可互读；
- 密钥不得写入 `host.storage`（storage.json 明文落盘）或 localStorage；
- 发起网络请求需要携带密钥时，应通过 `host.network.fetch` 的 `@secret(name)` 头引用完成，
  插件代码全程不接触明文；
- 安全存储不可用时 `status` 返回 `secureStorageAvailable: false`、`set` 报错，插件应给出
  可操作提示（如"系统凭据管理器不可用"）而不是静默失败。

### 5.3 messages:read 权限边界（P0，已确定）

若插件声明 `messages:read` 权限，宿主提供**当前频道消息**的只读读取能力，边界如下：

- 只暴露两个方法：
  - `host.messages.readCurrentChannel({ maxMessages? })`：返回当前频道**已载入时间线**的快照
    （`channelId` / `channelName` / `messages`（时间升序）/ `totalCount` / `truncated` /
    `hasMoreHistory` / `capturedAtMs`）。单次最多 500 条（越界由宿主钳制；ai-summary 插件侧
    的总结条数上限与之保持一致），该调用不发起网络请求、不改动聊天视图；
    快照还会带上聊天视图**当前多选中**的消息（`selectedMessageIds`（仅"已载入且可参与总结"的
    id，时间线顺序）/ `selectedTotalCount`（原始多选条数，含被过滤/未载入的条目）），
    供插件让用户显式圈定处理范围；这不构成新的读取权限——仍是同一频道、同一 `messages:read`
    门控，只是按用户圈定收敛；未处于多选或旧宿主未提供该字段时为空数组/0。
  - `host.messages.loadMoreHistory()`：向更早历史翻页一页并回报调用前后的条数变化
    （`loadedCount` / `loadedDelta` / `hasMore`），插件只应在用户显式动作（点击按钮）时调用。
- 不接受任意 `channelId`：插件无法读取用户未打开的频道，也无法读取其他服务器。
- 读取结果已由宿主过滤撤回消息与空内容；插件**不得持久化消息正文**（缓存只允许保存摘要与
  “参与消息集合指纹 + 末条消息 id + 参与条数”指纹，集合指纹由消息 id 计算，不含正文）。
- 未声明该权限时宿主不注入 `host.messages`，插件应提示用户升级/重新安装插件而不是静默失败。

### 5.4 设置项注册（已实现）

若插件声明 `ui` 权限，除 overlay / 工具栏入口外，还可通过 `ctx.ui.registerSettingsItem({ id, title, description?, keywords?, order?, component })`
把设置项注册到宿主设置页的「插件设置」分区；宿主负责卡片外壳、按插件分组、错误边界与左侧搜索索引。

实现要点：

- **注册表**：每个 server 一份 `PluginSettingsRegistry`（`runtime/pluginSettingsRegistry.ts`，纯数据、不依赖 Vue），
  由 `domainRegistryStore` 投影为响应式 `pluginSettingsItems`（组件统一 `markRaw`），设置页经
  `plugins/api → forServer(socket).listPluginSettingsItems()` 消费；
- **作用域**：设置项归属当前 server（`normalizeServerKey`），停用/卸载插件或切换 server 后立即消失；
- **生命周期**：注册经 `ctx.effect` 绑定插件 fiber，fiber 销毁自动反注册；store 停用插件时另有 `unregister` 兜底；
- **搜索**：宿主用「标题 + 说明 + 关键词 + 分区名 + 插件 id」建立索引，插件需自行本地化文案并给出中英关键词；
- **取值**：插件设置值由插件用 `ctx.storage` 自行持久化，宿主不代管。

## 6. required gate（客户端行为）

- 连接服务器后，若发现 required 插件未满足：
  - 允许：查看服务器信息、打开插件中心、下载/安装/启用 required 插件
  - 禁止：进入登录流程
