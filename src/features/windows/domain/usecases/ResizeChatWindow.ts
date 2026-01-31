/**
 * @fileoverview ResizeChatWindow.ts 文件职责说明。
 */
import type { WindowCommandsPort } from "../ports/WindowCommandsPort";

export class ResizeChatWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * execute method.
   * @returns TODO.
   */
  execute(): Promise<void> {
    return this.windows.toChatWindowSize();
  }
}

