# `src/features` 结构说明（Feature / Subfeature）

本项目采用“按 Feature 划分 +（必要时）Subfeature 细分”的结构组织代码，并且**不保留旧路径的向前兼容**：所有 import 必须指向当前真实路径。

## 模块级文档（强约定）

- 每个 feature 目录必须提供 `README.md`，用于说明该模块的：
  - 定位（为什么存在）
  - 职责边界（做什么/不做什么）
  - 关键概念与核心入口（关键文件导航）
  - 关键流程（数据流/调用链概览）
  - 与其他模块的协作方式
- 若未来出现 `subfeatures/<name>/`，则 **每个子包也必须提供 `subfeatures/<name>/README.md`**，其内容标准与 feature README 一致。
- 除 `README.md` 外，不要求在 `di/data/domain/...` 目录额外增加“文档占位文件”（避免无意义的 `index.ts` 只为写说明）。

## 总体约定

每个 Feature 目录下可以包含以下目录（按需出现）：

- `presentation/`：页面/组件/store（UI）
- `di/`：依赖注入与选择逻辑（mock vs live）
- `domain/`：ports / types / usecases
- `data/`：HTTP/WS/Tauri 等适配器
- `mock/`：mock adapters / mock stores
- `test/`：feature 级测试
- `subfeatures/`：仅在存在明确层级关系（多个子域/流程/子能力）时引入

约束：

- `presentation` → `di` → `domain` → `data/mock`
- `presentation` 之间尽量不要互相引用；需要共享时，优先抽到 Feature 根目录的 `domain/*`、`data/*`，或 `src/shared/*`
- **跨 Feature 只能通过 `src/features/<feature>/api.ts` 访问**（公共边界）；
  禁止直接 import 其它 Feature 的 `presentation/*`、`data/*`、`di/*`、`domain/*` 内部路径。

### Subfeature 规则（避免“为了划分而划分”）

- 只有当某 Feature 内部存在多个明显子域/流程/子能力（且它们各自有相对独立的 presentation）时，才创建 `subfeatures/<name>/`
- 如果只是“一个 Feature + 若干页面/组件”，优先直接放在 Feature 根目录的 `presentation/` 中
- 当前仓库已完成一次清理：现阶段 `src/features/*` 不使用 `subfeatures/`，后续如出现明确层级再引入

## 快速入口（从 README 开始读）

- `auth`：`src/features/auth/README.md`
- `chat`：`src/features/chat/README.md`
- `files`：`src/features/files/README.md`
- `network`：`src/features/network/README.md`
- `platform`：`src/features/platform/README.md`
- `plugins`：`src/features/plugins/README.md`
- `servers`：`src/features/servers/README.md`
- `settings`：`src/features/settings/README.md`
- `user`：`src/features/user/README.md`

## Mock 模式（store / protocol）

运行时 mock 配置位于 `src/shared/config/runtime.ts:1`：

- `VITE_USE_MOCK_API=true`：开启 mock
- `VITE_MOCK_MODE=store`（默认）：使用 feature 本地 mock ports/stores（更偏 UI 预览）
- `VITE_MOCK_MODE=protocol`：启用**协议级** mock transport（HTTP+WS），让 live stores 走真实的 HTTP/WS adapter，但不会访问真实网络（插件 runtime 动态加载默认禁用）

模式选择工具：

- `src/shared/config/mockModeSelector.ts:1`（统一 `off/store/protocol` 选择，避免各 feature 手写分支漂移）

协议级 mock 的实现入口：

- HTTP：`src/shared/net/http/httpJsonClient.ts:1`（在 `USE_MOCK_TRANSPORT=true` 时转发到 `src/shared/mock/protocol/protocolMockTransport.ts:1`）
- Chat WS：`src/features/chat/data/wsChatEvents.ts:1`（在 `USE_MOCK_TRANSPORT=true` 时使用 protocol mock WS）

## Feature 索引

### `auth`

- `data / di / domain / mock`：Auth ports/usecases、HTTP/mock 适配、DI
- `presentation`：登录页（Handshake + Email Code Login）与 Required Setup

### `chat`

- `data / di / domain`：Chat domain/usecases、HTTP/WS 端口、DI
- `mock`：chat store 的 in-memory mock
- `presentation`：主聊天页（/chat）、频道管理页、消息时间线组件、composer、quick switcher、chat store 门面

### `files`

- `data / di / domain / mock`：文件上传 domain/usecases、HTTP/mock 适配、DI
- `presentation`：上传按钮/进度/store + 文件消息气泡渲染

### `settings`

- `data / di / domain / mock / test`：配置端口、DI、usecases（例如 theme）
- `presentation`：设置页（/settings）

### `user`

- `data / di / domain / mock`：用户 domain/usecases、HTTP/mock 适配、DI
- `presentation`：当前用户 store（`currentUser`）+ 用户资料页（/user_info）+ 用户信息 popover

### `servers`

- `data / di / domain / mock`：server info domain/usecases、HTTP/mock 适配、DI
- `presentation`：当前选中 server socket store、server info 缓存 store、服务器列表/管理页（/servers）+ rack store

### `plugins`

- `data / di / domain / mock`：plugins domain/usecases、DI（PluginManagerPort 选择逻辑）、catalog/lifecycle/runtime/registry 支撑
- `presentation`：插件中心 UI（/plugins）+ stores

### `network`

- `data / di / domain / mock / test`：TCP/加密/Tauri 连接器、DI、domain/usecases、mock/test
- `presentation`：连接状态 store（ConnectionPill）

### `platform`

- `data / di / domain`：窗口命令端口/用例/Tauri 适配（多窗口打开、尺寸调整等）

## 常用 import 示例

- 跨 Feature 访问 plugins 能力：
  - `import { getPluginManagerPort } from "@/features/plugins/api";`
- 跨 Feature 访问 network 连接状态：
  - `import { connectWithRetry } from "@/features/network/api";`
- 跨 Feature 访问 servers 上下文：
  - `import { useCurrentServerContext } from "@/features/servers/api";`
- 使用 chat store 门面：
  - `import { ensureChatReady } from "@/features/chat/presentation/store/chatStore";`
- 使用当前用户 store：
  - `import { currentUser } from "@/features/user/api";`
