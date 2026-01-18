import { Member } from "../value/memberValue.ts";

export interface Channel {
  cid: number;
  avatarUrl: string;
  participants: Member[];
  channelName: string;
  latestMessage?: string;
  description?: string;
}