/**
 * @fileoverview CurrentServerPort.ts 文件职责说明。
 */
export interface CurrentServerPort {
  get(): string;
  set(serverSocket: string): void;
}

