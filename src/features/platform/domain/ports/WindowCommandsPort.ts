/**
 * @fileoverview WindowCommandsPort.ts
 * @description platform｜领域端口：WindowCommandsPort。
 */
/**
 * 打开 popover 窗口的参数。
 */
export type OpenPopoverWindowArgs = {
  query: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * 打开信息窗口的参数。
 */
export type OpenInfoWindowArgs = {
  label: string;
  title: string;
  query: string;
  width: number;
  height: number;
};

/**
 * 窗口命令端口（domain 层）。
 *
 * 说明：
 * - 抽象桌面端窗口相关命令（弹窗、信息窗口等）；
 * - 具体实现由 data 层提供（Tauri commands）。
 */
export interface WindowCommandsPort {
  /**
   * 将主聊天窗口调整到当前平台的推荐尺寸。
   *
   * @returns 无返回值。
   */
  toChatWindowSize(): Promise<void>;

  /**
   * 在屏幕某个坐标附近打开轻量 popover 窗口。
   *
   * @param args - 打开参数。
   * @returns 无返回值。
   */
  openPopoverWindow(args: OpenPopoverWindowArgs): Promise<void>;

  /**
   * 打开通用信息窗口（展示任意内容/页面）。
   *
   * @param args - 打开参数。
   * @returns 无返回值。
   */
  openInfoWindow(args: OpenInfoWindowArgs): Promise<void>;
}
