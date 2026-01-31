/**
 * @fileoverview tauriWindowCommandsAdapter.ts 文件职责说明。
 */
import { invokeTauri, TAURI_COMMANDS } from "../../../shared/tauri";
import type {
  OpenInfoWindowArgs,
  OpenPopoverWindowArgs,
  WindowCommandsPort,
} from "../domain/ports/WindowCommandsPort";

/**
 * Exported constant.
 * @constant
 */
export const tauriWindowCommandsAdapter: WindowCommandsPort = {
  /**
   * toChatWindowSize method.
   * @returns TODO.
   */
  async toChatWindowSize(): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.toChatWindowSize);
  },
  /**
   * openPopoverWindow method.
   * @param args - TODO.
   * @returns TODO.
   */
  async openPopoverWindow(args: OpenPopoverWindowArgs): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.openPopoverWindow, args);
  },
  /**
   * openInfoWindow method.
   * @param args - TODO.
   * @returns TODO.
   */
  async openInfoWindow(args: OpenInfoWindowArgs): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.openInfoWindow, args);
  },
};
