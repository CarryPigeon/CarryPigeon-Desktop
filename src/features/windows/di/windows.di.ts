/**
 * @fileoverview windows.di.ts 文件职责说明。
 */
import { tauriWindowCommandsAdapter } from "../data/tauriWindowCommandsAdapter";
import { OpenInfoWindow } from "../domain/usecases/OpenInfoWindow";
import { OpenPopoverWindow } from "../domain/usecases/OpenPopoverWindow";
import { ResizeChatWindow } from "../domain/usecases/ResizeChatWindow";

let resizeChatWindow: ResizeChatWindow | null = null;
let openPopoverWindow: OpenPopoverWindow | null = null;
let openInfoWindow: OpenInfoWindow | null = null;

/**
 * getResizeChatWindowUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getResizeChatWindowUsecase(): ResizeChatWindow {
  if (resizeChatWindow) return resizeChatWindow;
  resizeChatWindow = new ResizeChatWindow(tauriWindowCommandsAdapter);
  return resizeChatWindow;
}

/**
 * getOpenPopoverWindowUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getOpenPopoverWindowUsecase(): OpenPopoverWindow {
  if (openPopoverWindow) return openPopoverWindow;
  openPopoverWindow = new OpenPopoverWindow(tauriWindowCommandsAdapter);
  return openPopoverWindow;
}

/**
 * getOpenInfoWindowUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getOpenInfoWindowUsecase(): OpenInfoWindow {
  if (openInfoWindow) return openInfoWindow;
  openInfoWindow = new OpenInfoWindow(tauriWindowCommandsAdapter);
  return openInfoWindow;
}
