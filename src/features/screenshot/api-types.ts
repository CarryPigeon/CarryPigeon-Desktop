import type { ScreenCapture } from "./domain/contracts";

export type { ScreenCapture };

export type ScreenshotCapabilities = {
  startScreenshot(): Promise<void>;
  getScreenshotData(): Promise<ScreenCapture[]>;
  finishScreenshot(data: number[]): Promise<string>;
  cancelScreenshot(): Promise<void>;
};
