/**
 * @fileoverview ConnectServer.ts 文件职责说明。
 */
import { AuthError } from "../errors/AuthError";
import type { TcpConnectorPort } from "../../../network/domain/ports/TcpConnectorPort";
import type { CurrentServerPort } from "../../../servers/domain/ports/CurrentServerPort";

export type ConnectServerInput = {
  serverSocket: string;
};

export class ConnectServer {
  constructor(
    private readonly tcpConnector: TcpConnectorPort,
    private readonly currentServer: CurrentServerPort,
  ) {}

  /**
   * execute method.
   * @param input - TODO.
   * @returns TODO.
   */
  async execute(input: ConnectServerInput): Promise<void> {
    const raw = input.serverSocket.trim();
    const serverSocket = normalizeServerSocket(raw);
    if (!serverSocket) throw new AuthError("Missing server socket");

    await this.tcpConnector.connect(serverSocket);
    this.currentServer.set(serverSocket);
  }
}

/**
 * normalizeServerSocket 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
function normalizeServerSocket(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Keep explicit schemes (mock/tls/tcp) as-is.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  // Default to TLS transport.
  return `tls://${trimmed}`;
}
