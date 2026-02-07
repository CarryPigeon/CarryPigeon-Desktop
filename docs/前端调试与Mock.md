# 前端调试与 Mock 切换

本项目支持在不接入服务端时使用 Mock 数据，并可随时切换到真实后端。

## 一、启用 Mock

1. 新建或修改 ` .env.local `（或 ` .env.development `）。
2. 设置以下环境变量：

```env
VITE_USE_MOCK_API=true
VITE_MOCK_MODE=store
VITE_MOCK_LATENCY_MS=120
VITE_MOCK_SERVER_SOCKET=mock://handshake
```

说明：

- `VITE_USE_MOCK_API=true`：启用 Mock 服务（频道、消息、成员、登录等都会走本地 Mock）。
- `VITE_MOCK_MODE=store`：启用 feature 内存 mock（更偏 UI 预览）。
- `VITE_MOCK_MODE=protocol`：启用协议级 mock（HTTP + WS 走 protocol mock transport，更偏联调验证）。
- `VITE_MOCK_LATENCY_MS`：模拟网络延迟（毫秒）。
- `VITE_MOCK_SERVER_SOCKET`：模拟的 server socket。

Mock 行为特性：

- 登录页会自动填入 `server socket` 与 `ECC 公钥`（避免手动输入）。
- 任意邮箱 + 验证码可登录（Mock 不校验）。
- 频道/消息/成员为内存态数据（刷新后会重置）。

## 二、切换到真实后端

1. 将 `VITE_USE_MOCK_API` 设为 `false` 或直接删除该环境变量（`VITE_MOCK_MODE` 此时会被忽略）。
2. 登录页手动输入服务端提供的：
   - `server socket`
   - `server ECC 公钥`
3. 使用邮箱验证码登录，token 来自登录接口返回值。

## 三、推荐配置文件

你可以在仓库根目录使用以下文件组织配置：

- ` .env.local `：本机私有配置，不提交
- ` .env.development `：团队统一的开发配置（可提交）
- ` .env.production `：生产配置

## 四、环境切换标准（验收口径）

以 `src/shared/config/runtime.ts` 为唯一真源，团队统一按以下口径判断：

- `MOCK_MODE=off`：`VITE_USE_MOCK_API=false`（或未设置）时生效，走真实后端链路。
- `MOCK_MODE=store`：feature 内 mock ports/store 生效，适合纯 UI 预览。
- `MOCK_MODE=protocol`：保留 live adapter，但 HTTP/WS 走协议级 mock transport，适合集成联调。

验收标准：

- 环境变量解析必须集中在 `runtime.ts`，业务代码不直接解析 `import.meta.env`。
- feature 侧 mock 选择必须在 `di/`（或明确的 store 入口）完成，避免散落分支。
- `store` 与 `protocol` 必须语义分离：`store` 才使用内存 mock；`protocol` 应尽量走协议面。

## 五、Feature 行为矩阵（off / store / protocol）

| Feature | off（真实后端） | store（本地内存 mock） | protocol（协议级 mock） |
| --- | --- | --- | --- |
| auth | HTTP auth/email 服务 | mockAuth/mockEmail | HTTP adapter（由 protocol transport 接管） |
| user | HTTP user 服务 | mockUserService | HTTP user 服务（transport mock） |
| chat | live store + HTTP/WS | `mockChatStore` | live store + HTTP/WS（两者都走 protocol mock） |
| files | HTTP file 服务 | mockFileService | HTTP file 服务（transport mock） |
| servers | HTTP serverInfo | mockServerInfo | HTTP serverInfo（transport mock） |
| plugins（manager） | hybridPluginManager | mockPluginManager | protocolMockPluginManager（catalog 走 HTTP 协议 mock） |
| plugins（runtime） | 启用插件 runtime | 关闭 runtime 加载 | 关闭 runtime 加载（protocol 仅验证协议面） |
| settings | localStorageConfig | mockConfigPort | localStorageConfig（保证主题稳定） |
| network | tauriTcpConnector | mockTcpConnector | mockTcpConnector（避免真实 TCP） |
| platform | tauri window commands | tauri window commands | tauri window commands |

补充说明：

- `servers/currentServer` 与 `serverList` 在 `store/protocol` 下都会默认注入 `MOCK_SERVER_SOCKET`。
- `domain catalog` 在 `protocol` 下应可拉取（不应被当作 `store` 直接清空）。
- 文件下载链接在 `protocol` 模式下返回 data URL（避免访问真实网络）。
- `required-gate` 在 `store` 下走本地 mock catalog；在 `off/protocol` 下走服务端/协议端检查。

## 六、推荐自检清单

每次改动 mock/环境切换逻辑后，建议至少做以下检查：

1. `npm run lint`
2. `npx vue-tsc --noEmit`
3. 手动验证三种模式：
   - `off`：可访问真实服务端；
   - `store`：离线可进入主要 UI；
   - `protocol`：live store 正常，但网络请求不出真实网。

## 七、DI 接入模板（推荐）

统一使用 `src/shared/config/mockModeSelector.ts`，避免每个 feature 重复手写三元判断。

### 7.1 三态选择（off/store/protocol）

适用于“protocol 语义与 off 不同”或需要显式声明三态的场景：

```ts
import { selectByMockMode } from "@/shared/config/mockModeSelector";

const impl = selectByMockMode({
  off: () => liveImpl,
  store: () => storeMockImpl,
  protocol: () => protocolImpl, // 可省略；省略时回退到 off
});
```

### 7.2 二态选择（mock-enabled / live）

适用于“只区分是否启用 mock”的场景（例如 connector、默认值注入）：

```ts
import { selectByMockEnabled } from "@/shared/config/mockModeSelector";

const value = selectByMockEnabled(
  () => mockValue,
  () => liveValue,
);
```

### 7.3 反例（不推荐）

- 在业务文件直接写 `import.meta.env.VITE_*`。
- 在多个 feature 手写分支：`if (USE_MOCK_TRANSPORT) ... else if (IS_STORE_MOCK) ...`。
- 把 `store` 与 `protocol` 混用，导致协议联调被本地内存 mock 短路。

建议：

- 运行时变量只在 `runtime.ts` 解析；
- 模式分支只在 `di/` 或明确的 store 入口；
- 新 feature 默认先套用上方模板，再根据业务差异补充注释。
