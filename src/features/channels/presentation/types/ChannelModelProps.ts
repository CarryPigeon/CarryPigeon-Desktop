/**
 * @fileoverview ChannelModelProps.ts 文件职责说明。
 */
export interface ChannelModelProps {
  cid?: number;
  imgUrl: string;
  channelName: string;
  latestMsg: string;
  bio?: string;
  owner?: number;
  active?: boolean;
  onClick?: () => void;
}
