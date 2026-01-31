/**
 * @fileoverview push.di.ts 文件职责说明。
 */
import { tcpPushChannelAdapter } from "../data/tcpPushChannelAdapter";
import { ForwardChannelMessage } from "../domain/usecases/ForwardChannelMessage";

let forwardChannelMessage: ForwardChannelMessage | null = null;

/**
 * getForwardChannelMessageUsecase 方法说明。
 * @returns 返回值说明。
 */
export function getForwardChannelMessageUsecase(): ForwardChannelMessage {
  if (forwardChannelMessage) return forwardChannelMessage;
  forwardChannelMessage = new ForwardChannelMessage(tcpPushChannelAdapter);
  return forwardChannelMessage;
}

