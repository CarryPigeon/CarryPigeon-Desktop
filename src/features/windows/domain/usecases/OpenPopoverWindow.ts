/**
 * @fileoverview OpenPopoverWindow.ts 文件职责说明。
 */
import type { OpenPopoverWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

export class OpenPopoverWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * execute method.
   * @param args - TODO.
   * @returns TODO.
   */
  execute(args: OpenPopoverWindowArgs): Promise<void> {
    return this.windows.openPopoverWindow(args);
  }
}

