/**
 * @fileoverview DecideChannelApplication.ts
 * @description chat｜用例：DecideChannelApplication。
 */

import type { ChatApiPort } from "../ports/chatApiPort";

/**
 * 用例：审批入群申请。
 */
export class DecideChannelApplication {
  constructor(private readonly api: ChatApiPort) {}

  /**
   * 执行：审批入群申请。
   *
   * @param serverSocket - 服务器 Socket 地址。
   * @param accessToken - 访问令牌（Bearer）。
   * @param channelId - 频道 id。
   * @param applicationId - 申请 id。
   * @param decision - `"approve"` 或 `"reject"`。
   * @returns 无返回值。
   */
  execute(
    serverSocket: string,
    accessToken: string,
    channelId: string,
    applicationId: string,
    decision: "approve" | "reject",
  ): Promise<void> {
    return this.api.decideChannelApplication(serverSocket, accessToken, channelId, applicationId, decision);
  }
}
