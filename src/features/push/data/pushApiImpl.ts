/**
 * @fileoverview pushApiImpl.ts 文件职责说明。
 */
import { tcpPushChannelAdapter } from "./tcpPushChannelAdapter";

export type { MessageCommon, UIMessageCommon } from "../domain/types/PushMessages";

/**
 * parseChannelMessage 方法说明。
 * @param channelSocket - 参数说明。
 * @param message - 参数说明。
 * @returns 返回值说明。
 */
export async function parseChannelMessage(channelSocket: string, message: string) {
  await tcpPushChannelAdapter.forwardChannelMessage({ channelSocket, message });
}

/**
 * praseChannelMessage 方法说明。
 * @param channelSocket - 参数说明。
 * @param message - 参数说明。
 * @returns 返回值说明。
 */
export async function praseChannelMessage(channelSocket: string, message: string) {
  return parseChannelMessage(channelSocket, message);
}
