/**
 * @fileoverview ConnectToServer.ts
 * @description Usecase: connect/handshake with a server socket via injected TCP connector port.
 */

import type { TcpConnectorPort } from "../ports/TcpConnectorPort";

export class ConnectToServer {
  constructor(private readonly tcp: TcpConnectorPort) {}

  /**
   * Connect (and handshake) with a server socket.
   *
   * This usecase intentionally stays thin: it delegates the transport details
   * to the injected `TcpConnectorPort` so UI/presentation code can remain
   * platform-agnostic (Tauri vs web preview).
   *
   * @param serverSocket - Target server socket string.
   * @returns Promise that resolves once the connector reports success.
   */
  execute(serverSocket: string): Promise<void> {
    return this.tcp.connect(serverSocket);
  }
}
