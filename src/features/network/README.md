# network（连接与传输）

## 定位

network 负责“客户端如何与服务端建立可靠连接”的底座能力：TCP/TLS 连接、握手与换钥、帧编解码、加密/解密，以及向上暴露一个稳定的“连接用例 + 连接状态 store”，供 UI 与其他 feature 复用。

## 职责边界

做什么：

- 提供 `ConnectToServer` 等领域用例与连接状态管理。
- 封装底层 TCP/TLS 与握手协议细节，保证上层只关注“连接是否可用/失败原因”。
- 在 mock 或协议 mock 场景下提供可预测行为，便于 UI 离线开发。

不做什么：

- 不负责 server 列表与 TLS 配置维护（由 `servers` feature 负责），network 只消费 TLS 配置。
- 不直接渲染聊天 UI（仅提供连接状态给 UI 组件使用）。

## 关键概念

- **TcpConnectorPort**：连接器端口抽象（domain 层），屏蔽 mock/live 以及 Tauri/浏览器运行时差异。
- **TcpService**：负责维护某个 server socket 的连接实例（包含帧收发与握手状态）。
- **Encryption**：负责握手后的加密/解密与换钥逻辑（上层只消费“明文 payload”）。
- **Frame Codec**：帧编解码（长度前缀/字节序等），保证协议实现集中、可复用。

## 目录结构

- `domain/`：连接相关 ports/usecases（例如 ConnectToServer）。
- `data/`：TCP service、加密、Tauri 连接器等实现。
- `di/`：依赖装配（mock/live）。
- `presentation/`：连接状态 store 与 UI（例如连接提示组件）。
- `mock/`：mock connector。

## 主要入口（导航）

- 领域端口：`src/features/network/domain/ports/TcpConnectorPort.ts`
- 领域用例：`src/features/network/domain/usecases/ConnectToServer.ts`
- Tauri 连接器实现：`src/features/network/data/tauriTcpConnector.ts`
- TCP service：`src/features/network/data/TcpService.ts`
- 加密与握手：`src/features/network/data/Encryption.ts`
- 帧编解码：`src/features/network/data/frameCodec.ts`
- 连接状态 store：`src/features/network/presentation/store/connectionStore.ts`

## 关键流程（概览）

- 建立连接：
  1) UI/上层调用 `ConnectToServer` 用例（传入 server socket）
  2) 用例通过 `TcpConnectorPort` 创建连接并初始化握手
  3) 握手成功后进入“可发送/可接收”的稳定状态
  4) 失败时返回结构化错误并在 store 中记录（用于 UI 提示与重试）

## 与其他模块的协作

- `servers`：提供 server socket 与 TLS 配置（policy/fingerprint），network 使用该配置决定连接策略。
- `shared/net/*`：HTTP/WS 层的通用请求封装；network 更偏 TCP/TLS 协议层。
- `chat`：通常通过连接状态决定是否展示“连接中/已断开”的提示与重连按钮。

## 相关文档

- `docs/客户端开发指南.md`
- `design/protocol/`（协议相关设计）
