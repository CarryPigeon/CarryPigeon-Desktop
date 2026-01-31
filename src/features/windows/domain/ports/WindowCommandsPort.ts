/**
 * @fileoverview WindowCommandsPort.ts 文件职责说明。
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
  toChatWindowSize(): Promise<void>;
  openPopoverWindow(args: OpenPopoverWindowArgs): Promise<void>;
  openInfoWindow(args: OpenInfoWindowArgs): Promise<void>;
}
