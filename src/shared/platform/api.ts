/**
 * @fileoverview shared/platform 对外 API。
 * @description
 * 统一暴露窗口相关平台能力，用于跨 feature 调用。
 */

export { getOpenInfoWindowUsecase, getOpenPopoverWindowUsecase, getResizeChatWindowUsecase } from "./di/windows.di";
export type { OpenInfoWindowArgs, OpenPopoverWindowArgs, WindowCommandsPort } from "./domain/ports/WindowCommandsPort";

