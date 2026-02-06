/**
 * @fileoverview OpenInfoWindow.ts
 * @description platform｜用例：OpenInfoWindow。
 */
import type { OpenInfoWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

/**
 * 打开通用的信息窗口（例如“关于/帮助/提示”）。
 */
export class OpenInfoWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * 打开一个通用信息窗口。
   *
   * @param args - 窗口打开参数（由实现决定）。
   * @returns 无返回值。
   */
  public execute(args: OpenInfoWindowArgs): Promise<void> {
    return this.windows.openInfoWindow(args);
  }
}
