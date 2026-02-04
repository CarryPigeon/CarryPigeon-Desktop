# `src/features` 结构说明（Feature / Subfeature）

本项目采用“按 Feature 划分 +（必要时）Subfeature 细分”的结构组织代码，并且**不保留旧路径的向前兼容**：所有 import 必须指向当前真实路径。

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

### Subfeature 规则（避免“为了划分而划分”）

- 只有当某 Feature 内部存在多个明显子域/流程/子能力（且它们各自有相对独立的 presentation）时，才创建 `subfeatures/<name>/`
- 如果只是“一个 Feature + 若干页面/组件”，优先直接放在 Feature 根目录的 `presentation/` 中
- 当前仓库已完成一次清理：现阶段 `src/features/*` 不使用 `subfeatures/`，后续如出现明确层级再引入

## Mock 模式（store / protocol）

运行时 mock 配置位于 `src/shared/config/runtime.ts:1`：

- `VITE_USE_MOCK_API=true`：开启 mock
- `VITE_MOCK_MODE=store`（默认）：使用 feature 本地 mock ports/stores（更偏 UI 预览）
- `VITE_MOCK_MODE=protocol`：启用**协议级** mock transport（HTTP+WS），让 live stores 走真实的 HTTP/WS adapter，但不会访问真实网络

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

- 使用某 Feature 的核心 DI：
  - `import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";`
- 使用 chat store 门面：
  - `import { ensureChatReady } from "@/features/chat/presentation/store/chatStore";`
- 使用当前用户 store：
  - `import { currentUser } from "@/features/user/presentation/store/userData";`
