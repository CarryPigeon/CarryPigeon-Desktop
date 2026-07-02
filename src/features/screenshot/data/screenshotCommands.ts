import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import type { ScreenCapture } from "../domain/contracts";

export function startScreenshot(hideWindow?: boolean): Promise<void> {
  return invoke(TAURI_COMMANDS.startScreenshot, { hideWindow });
}

export function getScreenshotData(): Promise<ScreenCapture[]> {
  return invoke(TAURI_COMMANDS.getScreenshotData);
}

export function finishScreenshot(data: number[]): Promise<string> {
  return invoke(TAURI_COMMANDS.finishScreenshot, { data });
}

export function cancelScreenshot(): Promise<void> {
  return invoke(TAURI_COMMANDS.cancelScreenshot);
}
