import type { ScreenshotCapabilities } from "./api-types";
import {
  startScreenshot,
  getScreenshotData,
  finishScreenshot,
  cancelScreenshot,
} from "./data/screenshotCommands";

let capabilities: ScreenshotCapabilities | null = null;

export function createScreenshotCapabilities(): ScreenshotCapabilities {
  return {
    startScreenshot,
    getScreenshotData,
    finishScreenshot,
    cancelScreenshot,
  };
}

export function getScreenshotCapabilities(): ScreenshotCapabilities {
  capabilities ??= createScreenshotCapabilities();
  return capabilities;
}
