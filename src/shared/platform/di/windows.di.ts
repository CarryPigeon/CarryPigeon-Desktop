/**
 * @fileoverview windows.di.ts
 * @description platform｜依赖组装（DI）：windows.di。
 */
import { tauriWindowCommandsAdapter } from "../data/tauriWindowCommandsAdapter";
import { OpenInfoWindow } from "../domain/usecases/OpenInfoWindow";
import { OpenPopoverWindow } from "../domain/usecases/OpenPopoverWindow";
import { ResizeChatWindow } from "../domain/usecases/ResizeChatWindow";

let resizeChatWindow: ResizeChatWindow | null = null;
let openPopoverWindow: OpenPopoverWindow | null = null;
let openInfoWindow: OpenInfoWindow | null = null;

/**
 * 获取 `ResizeChatWindow` 用例（单例）。
 *
 * @returns `ResizeChatWindow` 实例。
 */
export function getResizeChatWindowUsecase(): ResizeChatWindow {
  if (resizeChatWindow) return resizeChatWindow;
  resizeChatWindow = new ResizeChatWindow(tauriWindowCommandsAdapter);
  return resizeChatWindow;
}

/**
 * 获取 `OpenPopoverWindow` 用例（单例）。
 *
 * @returns `OpenPopoverWindow` 实例。
 */
export function getOpenPopoverWindowUsecase(): OpenPopoverWindow {
  if (openPopoverWindow) return openPopoverWindow;
  openPopoverWindow = new OpenPopoverWindow(tauriWindowCommandsAdapter);
  return openPopoverWindow;
}

/**
 * 获取 `OpenInfoWindow` 用例（单例）。
 *
 * @returns `OpenInfoWindow` 实例。
 */
export function getOpenInfoWindowUsecase(): OpenInfoWindow {
  if (openInfoWindow) return openInfoWindow;
  openInfoWindow = new OpenInfoWindow(tauriWindowCommandsAdapter);
  return openInfoWindow;
}
