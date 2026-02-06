/**
 * @fileoverview ConnectToServer.ts
 * @description network｜用例：ConnectToServer。
 */

import type { TcpConnectorPort } from "../ports/TcpConnectorPort";

/**
 * 用例：连接到服务端（展示层 -> domain）。
 *
 * 说明：
 * - 该用例本身不关心具体传输实现（Tauri/mock），由 `TcpConnectorPort` 注入；
 * - 上层可在展示层编排重试/超时/错误提示等策略。
 */
export class ConnectToServer {
  constructor(private readonly tcp: TcpConnectorPort) {}

  /**
   * 连接（并握手）到指定 server socket。
   *
   * 说明：
   * - 该用例刻意保持轻量：将传输层细节委托给注入的 `TcpConnectorPort`，
   *   使展示层保持平台无关（Tauri vs Web 预览）。
   *
   * @param serverSocket - 目标 server socket 字符串。
   * @returns 当连接器报告成功后 resolve 的 Promise。
   */
  execute(serverSocket: string): Promise<void> {
    return this.tcp.connect(serverSocket);
  }
}
