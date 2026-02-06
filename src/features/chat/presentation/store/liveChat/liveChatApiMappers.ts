/**
 * @fileoverview liveChat API DTO → 展示层模型映射器。
 * @description chat｜展示层状态（store）：liveChatApiMappers。
 * 将 HTTP API 返回的数据结构映射为展示层使用的类型，统一 trim/默认值等“容错语义”，
 * 避免散落在 store 的多个位置导致不一致。
 */

import type { ChatChannel, ChannelApplication, ChannelBan, ChannelMember } from "@/features/chat/presentation/store/chatStoreTypes";
import type { ChannelApplicationDto, ChannelBanDto, ChannelDto, ChannelMemberDto } from "@/features/chat/domain/types/chatWireDtos";

type ApiChannelLike = ChannelDto & { name?: string; brief?: string };

/**
 * 将 API member 映射为展示层类型。
 *
 * @param m - API member。
 * @returns 展示层 member。
 */
export function mapApiMember(m: ChannelMemberDto): ChannelMember {
  return {
    uid: String(m.uid ?? "").trim(),
    nickname: String(m.nickname ?? "").trim(),
    avatar: m.avatar,
    role: String(m.role ?? "member").trim() as ChannelMember["role"],
    joinTime: Number(m.join_time ?? 0),
  };
}

/**
 * 将 API application 映射为展示层类型。
 *
 * @param a - API application。
 * @returns 展示层 application。
 */
export function mapApiApplication(a: ChannelApplicationDto): ChannelApplication {
  return {
    applicationId: String(a.application_id ?? "").trim(),
    cid: String(a.cid ?? "").trim(),
    uid: String(a.uid ?? "").trim(),
    reason: String(a.reason ?? "").trim(),
    applyTime: Number(a.apply_time ?? 0),
    status: String(a.status ?? "pending").trim() as ChannelApplication["status"],
  };
}

/**
 * 将 API ban 映射为展示层类型。
 *
 * @param b - API ban。
 * @returns 展示层 ban。
 */
export function mapApiBan(b: ChannelBanDto): ChannelBan {
  return {
    cid: String(b.cid ?? "").trim(),
    uid: String(b.uid ?? "").trim(),
    until: Number(b.until ?? 0),
    reason: String(b.reason ?? "").trim(),
    createTime: Number(b.create_time ?? 0),
  };
}

/**
 * 将 API channel 映射为展示层类型。
 *
 * @param c - API channel。
 * @returns 展示层 channel。
 */
export function mapApiChannel(c: ChannelDto): ChatChannel {
  const cc = c as ApiChannelLike;
  const cid = String(cc.cid ?? "").trim();
  return {
    id: cid,
    name: String(cc.name ?? cid).trim() || cid,
    brief: String(cc.brief ?? "").trim(),
    unread: 0,
    joined: true,
    joinRequested: false,
  };
}
