/**
 * @fileoverview OpenInfoWindow.ts 文件职责说明。
 */
import type { OpenInfoWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

export class OpenInfoWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * execute method.
   * @param args - TODO.
   * @returns TODO.
   */
  execute(args: OpenInfoWindowArgs): Promise<void> {
    return this.windows.openInfoWindow(args);
  }
}
