/**
 * @fileoverview PushChannelPort.ts 文件职责说明。
 */
export type ForwardChannelMessageArgs = {
  channelSocket: string;
  message: string;
};

export interface PushChannelPort {
  forwardChannelMessage(args: ForwardChannelMessageArgs): Promise<void>;
}

