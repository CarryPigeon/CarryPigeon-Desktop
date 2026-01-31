# 客户端设计总览（草案）

范围：仅客户端设计（PC + 移动端，均采用 Web/Vue 技术路线）。服务端内部插件/模块化设计不在本目录展开；这里只定义客户端需要的接口与行为假设。

## 1. 设计目标
- **跨端一致**：同一套插件包（ESM + 静态资源 + Vue 组件）可在 PC 与移动端加载运行。
- **server_socket 隔离**：插件安装/启用/版本/本地数据缓存按 `server_socket` 分区。
- **核心稳定**：核心包提供频道群聊基座；插件扩展消息 domain 的输入（composer）与渲染（renderer）。
- **可演进**：允许从“同进程加载”演进到“沙箱隔离加载”，不破坏插件 API 与契约。

## 2. 核心模块（客户端）
- Server 管理：服务器列表、连接状态、required 插件安装向导
- Auth：登录/注册/token 绑定会话（受 required gate 影响）
- Channel：频道列表、入群申请、成员与权限、禁言
- Message：消息列表/推送/分页、回复、删除（硬删除消失）
- Plugin Center：目录/仓库、安装/启用/禁用/卸载、权限展示、更新

## 3. 插件能力边界
- 插件“可做什么”由宿主 API 决定；插件不得直接访问 token、跨服务器缓存、或宿主内部状态。
- 插件权限为粗粒度集合（例如 network/storage/clipboard/notifications），但宿主仍需按最小能力原则注入 API。

## 4. 关键未决策（需要与你渐进式确认）
1) 插件执行隔离级别：v1 同进程 ESM；v2 iframe/Worker 沙箱（见 `design/client/PLUGIN-RUNTIME.md`）
2) 插件资源加载方式：本地 file:// / app:// / http(s)://（影响 CSP 与缓存策略）
3) 移动端容器形态（仅影响工程实现，不影响插件契约）：WebView 宿主/Hybrid 框架选择

