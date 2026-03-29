/**
 * @fileoverview TCP 连接器端口（domain 层）。
 * @description 抽象 TCP 连接能力，供 usecase 注入，以隔离 platform/data 细节。
 */
export type TcpConnectOptions = Record<string, never>;

/**
 * TCP 连接器端口（domain 层）。
 *
 * 说明：
 * - 该端口只描述“建立连接”的能力；
 * - 具体传输实现由 data/mock 层提供（例如 tauri sidecar 或 mock）。
 */
export interface TcpConnectorPort {
  /**
   * 连接到指定 server socket。
   *
   * 说明：
   * - 该端口只负责“建立连接”的能力抽象；具体协议握手与重连策略由上层编排。
   *
   * @param serverSocket - 服务器 Socket 地址（例如 `tcp://host:port` 或其它协议映射）。
   * @param _opts - 预留参数（当前未使用）。
   * @returns 无返回值。
   */
  connect(serverSocket: string, _opts?: TcpConnectOptions): Promise<void>;
}
