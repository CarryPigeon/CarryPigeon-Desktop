import { invoke } from "@tauri-apps/api/core";
import type { ScreenCapture } from "../domain/contracts";

export function startScreenshot(): Promise<void> {
  return invoke("start_screenshot");
}

export function getScreenshotData(): Promise<ScreenCapture[]> {
  return invoke("get_screenshot_data");
}

export function finishScreenshot(data: number[]): Promise<string> {
  return invoke("finish_screenshot", { data });
}

export function cancelScreenshot(): Promise<void> {
  return invoke("cancel_screenshot");
}
