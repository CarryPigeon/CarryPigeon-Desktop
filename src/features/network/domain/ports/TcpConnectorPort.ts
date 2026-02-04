/**
 * @fileoverview TCP 连接器端口（domain 层）。
 * @description 抽象 TCP 连接能力，供 usecase 注入，以隔离 platform/data 细节。
 */
export type TcpConnectOptions = Record<string, never>;

export interface TcpConnectorPort {
  connect(serverSocket: string, _opts?: TcpConnectOptions): Promise<void>;
}
