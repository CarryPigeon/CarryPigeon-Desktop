/**
 * @fileoverview liveChatChannelAdminActions.ts
 * @description chat｜展示层 store 子模块：频道管理动作（成员/管理员/申请/封禁/创建/删除）。
 *
 * 设计目标：
 * - 将“频道管理”相关的 HTTP 编排从 `liveChatStore.ts` 拆出，降低单文件复杂度。
 * - 通过参数注入 `getSocketAndValidToken` / `refreshChannels` 等依赖，避免与主 store 强耦合。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不主动输出日志）。
 */

import type { Ref } from "vue";
import type { ChannelApplication, ChannelBan, ChannelMember, ChatChannel } from "../chatStoreTypes";
import { mapApiApplication, mapApiBan, mapApiChannel, mapApiMember } from "./liveChatApiMappers";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";

/**
 * 获取当前 server socket 与可用 access token（均为 trim 后）。
 *
 * 说明：
 * - 该依赖用于让子模块不直接依赖“鉴权与当前 server 选择”的实现细节；
 * - 返回空字符串表示当前不可用（调用方应做空值兜底）。
 */
export type GetSocketAndValidToken = () => Promise<[string, string]>;

/**
 * 频道管理动作集合（成员/管理员/申请/封禁/创建/删除）。
 *
 * 说明：
 * - 该接口面向 UI 管理页调用；
 * - 具体实现由 `createLiveChatChannelAdminActions` 创建。
 */
export type LiveChatChannelAdminActions = {
  listMembers(channelId: string): Promise<ChannelMember[]>;
  kickMember(channelId: string, uid: string): Promise<void>;
  setAdmin(channelId: string, uid: string): Promise<void>;
  removeAdmin(channelId: string, uid: string): Promise<void>;
  listApplications(channelId: string): Promise<ChannelApplication[]>;
  decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void>;
  listBans(channelId: string): Promise<ChannelBan[]>;
  setBan(channelId: string, uid: string, until: number, reason: string): Promise<void>;
  removeBan(channelId: string, uid: string): Promise<void>;
  createChannel(name: string, brief?: string): Promise<ChatChannel>;
  deleteChannel(channelId: string): Promise<void>;
};

/**
 * 创建频道管理动作的依赖集合。
 */
export type CreateLiveChatChannelAdminActionsDeps = {
  api: ChatApiPort;
  getSocketAndValidToken: GetSocketAndValidToken;
  refreshChannels: () => Promise<void>;
  channelsRef: Ref<ChatChannel[]>;
  currentChannelId: Ref<string>;
};

/**
 * 创建频道管理动作集合。
 *
 * @param deps - 依赖注入（token 获取、刷新频道、关键状态引用）。
 * @returns 频道管理动作集合。
 */
export function createLiveChatChannelAdminActions(
  deps: CreateLiveChatChannelAdminActionsDeps,
): LiveChatChannelAdminActions {
  const { api, getSocketAndValidToken, refreshChannels, channelsRef, currentChannelId } = deps;

  /**
   * 列出频道成员列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelMember[]>。
   */
  async function listMembers(channelId: string): Promise<ChannelMember[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await api.listChannelMembers(socket, token, cid);
    return list.map(mapApiMember);
  }

  /**
   * 将成员踢出频道。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function kickMember(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.kickChannelMember(socket, token, cid, userId);
  }

  /**
   * 将用户设为管理员。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function setAdmin(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.addChannelAdmin(socket, token, cid, userId);
  }

  /**
   * 撤销用户管理员身份。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function removeAdmin(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.removeChannelAdmin(socket, token, cid, userId);
  }

  /**
   * 列出频道入群申请列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelApplication[]>。
   */
  async function listApplications(channelId: string): Promise<ChannelApplication[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await api.listChannelApplications(socket, token, cid);
    return list.map(mapApiApplication);
  }

  /**
   * 审批（通过/拒绝）入群申请。
   *
   * @param channelId - 频道 id。
   * @param applicationId - 申请 id。
   * @param approved - 是否通过。
   * @returns Promise<void>。
   */
  async function decideApplication(channelId: string, applicationId: string, approved: boolean): Promise<void> {
    const cid = String(channelId).trim();
    const aid = String(applicationId).trim();
    if (!cid || !aid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.decideChannelApplication(socket, token, cid, aid, approved ? "approve" : "reject");
  }

  /**
   * 列出频道禁言列表。
   *
   * @param channelId - 频道 id。
   * @returns Promise<ChannelBan[]>。
   */
  async function listBans(channelId: string): Promise<ChannelBan[]> {
    const cid = String(channelId).trim();
    if (!cid) return [];
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return [];

    const list = await api.listChannelBans(socket, token, cid);
    return list.map(mapApiBan);
  }

  /**
   * 对频道成员设置禁言。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @param until - 禁言截止时间戳（ms；0 表示永久）。
   * @param reason - 禁言原因。
   * @returns Promise<void>。
   */
  async function setBan(channelId: string, uid: string, until: number, reason: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.putChannelBan(socket, token, cid, userId, until, reason);
  }

  /**
   * 解除用户禁言。
   *
   * @param channelId - 频道 id。
   * @param uid - 用户 id。
   * @returns Promise<void>。
   */
  async function removeBan(channelId: string, uid: string): Promise<void> {
    const cid = String(channelId).trim();
    const userId = String(uid).trim();
    if (!cid || !userId) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.deleteChannelBan(socket, token, cid, userId);
  }

  /**
   * 创建频道。
   *
   * @param name - 频道名称。
   * @param brief - 频道简介。
   * @returns Promise<ChatChannel>。
   */
  async function createChannel(name: string, brief?: string): Promise<ChatChannel> {
    const channelName = String(name ?? "").trim();
    if (!channelName) throw new Error("Channel name is required");
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) throw new Error("Not signed in");

    const created = await api.createChannel(socket, token, { name: channelName, brief });
    await refreshChannels();
    return mapApiChannel(created);
  }

  /**
   * 删除频道，并尽量将当前频道切换到新的可用项。
   *
   * @param channelId - 频道 id。
   * @returns Promise<void>。
   */
  async function deleteChannel(channelId: string): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await getSocketAndValidToken();
    if (!socket || !token) return;

    await api.deleteChannel(socket, token, cid);
    await refreshChannels();

    if (currentChannelId.value === cid) {
      currentChannelId.value = channelsRef.value[0]?.id ?? "";
    }
  }

  return {
    listMembers,
    kickMember,
    setAdmin,
    removeAdmin,
    listApplications,
    decideApplication,
    listBans,
    setBan,
    removeBan,
    createChannel,
    deleteChannel,
  };
}
