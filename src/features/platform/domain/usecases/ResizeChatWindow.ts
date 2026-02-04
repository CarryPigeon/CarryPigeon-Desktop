/**
 * @fileoverview ResizeChatWindow.ts
 * @description Usecase: resize the main chat window via WindowCommandsPort.
 */
import type { WindowCommandsPort } from "../ports/WindowCommandsPort";

export class ResizeChatWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * Resize the chat window to its preferred size for the current platform.
   *
   * @returns Promise<void>
   */
  public execute(): Promise<void> {
    return this.windows.toChatWindowSize();
  }
}
