/**
 * @fileoverview plugins 运行时能力服务：server 上下文。
 */

import type { PluginServerService } from "../types";

export type ServerServiceOptions = {
  serverSocket: string;
  serverId: string;
  /** 实时读取当前频道 id（由宿主 bridge 提供）。 */
  getCid(): string;
  /** 实时读取当前用户 id。 */
  getUid(): string;
  /** 当前界面语言。 */
  lang: string;
};

/**
 * 创建服务器上下文服务（getCid / getUid 为实时读取）。
 */
export function createServerService(options: ServerServiceOptions): PluginServerService {
  return {
    serverSocket: options.serverSocket,
    serverId: options.serverId,
    getCid: () => options.getCid(),
    getUid: () => options.getUid(),
    lang: options.lang,
  };
}
