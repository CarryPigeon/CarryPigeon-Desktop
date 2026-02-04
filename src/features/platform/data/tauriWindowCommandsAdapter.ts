/**
 * @fileoverview Tauri window commands adapter.
 *
 * Data-layer adapter that implements `WindowCommandsPort` by invoking Tauri commands.
 */
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";
import type {
  OpenInfoWindowArgs,
  OpenPopoverWindowArgs,
  WindowCommandsPort,
} from "../domain/ports/WindowCommandsPort";

/**
 * WindowCommandsPort implementation backed by Tauri commands.
 *
 * @constant
 */
export const tauriWindowCommandsAdapter: WindowCommandsPort = {
  async toChatWindowSize(): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.toChatWindowSize);
  },
  async openPopoverWindow(args: OpenPopoverWindowArgs): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.openPopoverWindow, args);
  },
  async openInfoWindow(args: OpenInfoWindowArgs): Promise<void> {
    await invokeTauri(TAURI_COMMANDS.openInfoWindow, args);
  },
};
