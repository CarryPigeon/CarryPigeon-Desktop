/**
 * @fileoverview OpenPopoverWindow.ts
 * @description Usecase: open a popover window via WindowCommandsPort.
 */
import type { OpenPopoverWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

export class OpenPopoverWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * Open a lightweight popover window (e.g. user/channel quick info).
   *
   * @param args - Popover window open arguments.
   * @returns Promise<void>
   */
  public execute(args: OpenPopoverWindowArgs): Promise<void> {
    return this.windows.openPopoverWindow(args);
  }
}
