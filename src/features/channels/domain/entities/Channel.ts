/**
 * @fileoverview Channel.ts 文件职责说明。
 */
import type { Member } from "../../../user/domain/entities/Member";

export interface Channel {
  cid: number;
  avatarUrl: string;
  participants: Member[];
  channelName: string;
  latestMessage?: string;
  description?: string;
}

