/**
 * @fileoverview WindowCommandsPort.ts
 * @description Domain port for multi-window operations.
 */
export type OpenPopoverWindowArgs = {
  query: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OpenInfoWindowArgs = {
  label: string;
  title: string;
  query: string;
  width: number;
  height: number;
};

export interface WindowCommandsPort {
  /**
   * Resize the main chat window to its preferred size for the current platform.
   */
  toChatWindowSize(): Promise<void>;

  /**
   * Open a lightweight popover window near a screen point.
   */
  openPopoverWindow(args: OpenPopoverWindowArgs): Promise<void>;

  /**
   * Open a general-purpose info window.
   */
  openInfoWindow(args: OpenInfoWindowArgs): Promise<void>;
}
