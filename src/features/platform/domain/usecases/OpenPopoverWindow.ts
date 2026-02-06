/**
 * @fileoverview OpenPopoverWindow.ts
 * @description platform｜用例：OpenPopoverWindow。
 */
import type { OpenPopoverWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

/**
 * 打开轻量 popover 窗口（例如用户/频道的快速信息弹窗）。
 */
export class OpenPopoverWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * 打开一个轻量 popover 窗口（例如用户/频道的快速信息弹窗）。
   *
   * @param args - popover 窗口打开参数。
   * @returns 无返回值。
   */
  public execute(args: OpenPopoverWindowArgs): Promise<void> {
    return this.windows.openPopoverWindow(args);
  }
}
