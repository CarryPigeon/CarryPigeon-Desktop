/**
 * @fileoverview ForwardChannelMessage.ts 文件职责说明。
 */
import type { ForwardChannelMessageArgs, PushChannelPort } from "../ports/PushChannelPort";

export class ForwardChannelMessage {
  constructor(private readonly push: PushChannelPort) {}

  /**
   * execute method.
   * @param args - TODO.
   * @returns TODO.
   */
  execute(args: ForwardChannelMessageArgs): Promise<void> {
    return this.push.forwardChannelMessage(args);
  }
}

