/**
 * @fileoverview windows.di.ts
 * @description Composition root for windows feature (usecase singletons).
 */
import { tauriWindowCommandsAdapter } from "../data/tauriWindowCommandsAdapter";
import { OpenInfoWindow } from "../domain/usecases/OpenInfoWindow";
import { OpenPopoverWindow } from "../domain/usecases/OpenPopoverWindow";
import { ResizeChatWindow } from "../domain/usecases/ResizeChatWindow";

let resizeChatWindow: ResizeChatWindow | null = null;
let openPopoverWindow: OpenPopoverWindow | null = null;
let openInfoWindow: OpenInfoWindow | null = null;

/**
 * Get singleton `ResizeChatWindow` usecase.
 *
 * @returns Usecase instance.
 */
export function getResizeChatWindowUsecase(): ResizeChatWindow {
  if (resizeChatWindow) return resizeChatWindow;
  resizeChatWindow = new ResizeChatWindow(tauriWindowCommandsAdapter);
  return resizeChatWindow;
}

/**
 * Get singleton `OpenPopoverWindow` usecase.
 *
 * @returns Usecase instance.
 */
export function getOpenPopoverWindowUsecase(): OpenPopoverWindow {
  if (openPopoverWindow) return openPopoverWindow;
  openPopoverWindow = new OpenPopoverWindow(tauriWindowCommandsAdapter);
  return openPopoverWindow;
}

/**
 * Get singleton `OpenInfoWindow` usecase.
 *
 * @returns Usecase instance.
 */
export function getOpenInfoWindowUsecase(): OpenInfoWindow {
  if (openInfoWindow) return openInfoWindow;
  openInfoWindow = new OpenInfoWindow(tauriWindowCommandsAdapter);
  return openInfoWindow;
}
