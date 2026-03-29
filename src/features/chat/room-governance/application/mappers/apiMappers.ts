/**
 * @fileoverview room-governance 领域记录 → 子域模型映射器。
 * @description chat/room-governance｜application：统一领域记录到 room-governance / room-session 模型的容错映射语义。
 */

import type {
  ChatChannelApplicationRecord,
  ChatChannelBanRecord,
  ChatChannelMemberRecord,
  ChatChannelRecord,
} from "@/features/chat/domain/types/chatApiModels";
import type {
  ChannelApplication,
  ChannelBan,
  ChannelMember,
} from "@/features/chat/room-governance/domain/contracts";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";

export function mapApiMember(m: ChatChannelMemberRecord): ChannelMember {
  return {
    uid: String(m.userId ?? "").trim(),
    nickname: String(m.nickname ?? "").trim(),
    avatar: m.avatar,
    role: String(m.role ?? "member").trim() as ChannelMember["role"],
    joinTime: Number(m.joinTime ?? 0),
  };
}

export function mapApiApplication(a: ChatChannelApplicationRecord): ChannelApplication {
  return {
    applicationId: String(a.applicationId ?? "").trim(),
    cid: String(a.channelId ?? "").trim(),
    uid: String(a.userId ?? "").trim(),
    reason: String(a.reason ?? "").trim(),
    applyTime: Number(a.applyTime ?? 0),
    status: String(a.status ?? "pending").trim() as ChannelApplication["status"],
  };
}

export function mapApiBan(b: ChatChannelBanRecord): ChannelBan {
  return {
    cid: String(b.channelId ?? "").trim(),
    uid: String(b.userId ?? "").trim(),
    until: Number(b.until ?? 0),
    reason: String(b.reason ?? "").trim(),
    createTime: Number(b.createTime ?? 0),
  };
}

export function mapApiChannel(c: ChatChannelRecord): ChannelSummary {
  const cid = String(c.id ?? "").trim();
  return {
    id: cid,
    name: String(c.name ?? cid).trim() || cid,
    brief: String(c.brief ?? "").trim(),
    unread: 0,
    joined: true,
    joinRequested: false,
  };
}
