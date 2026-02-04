/**
 * @fileoverview OpenInfoWindow.ts
 * @description Usecase: open an info window via WindowCommandsPort.
 */
import type { OpenInfoWindowArgs, WindowCommandsPort } from "../ports/WindowCommandsPort";

export class OpenInfoWindow {
  constructor(private readonly windows: WindowCommandsPort) {}

  /**
   * Open a generic "info" window.
   *
   * @param args - Window open arguments (implementation-specific).
   * @returns Promise<void>
   */
  public execute(args: OpenInfoWindowArgs): Promise<void> {
    return this.windows.openInfoWindow(args);
  }
}
