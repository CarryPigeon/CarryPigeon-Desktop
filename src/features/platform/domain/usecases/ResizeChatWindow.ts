/**
 * @fileoverview ResizeChatWindow.ts
 * @description platform｜用例：ResizeChatWindow。
 */
import type { WindowCommandsPort } from "../ports/WindowCommandsPort";

/**
 * 将聊天窗口调整到当前平台推荐尺寸。
 */
export class ResizeChatWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * 将聊天窗口调整到当前平台的推荐尺寸。
   *
   * @returns 无返回值。
   */
  public execute(): Promise<void> {
    return this.windows.toChatWindowSize();
  }
}
