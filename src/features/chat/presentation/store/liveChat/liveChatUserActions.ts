/**
 * @fileoverview liveChat 用户动作（加入频道/更新频道元信息/删除消息）。
 * @description chat｜展示层（store 子模块）：liveChatUserActions。
 *
 * 职责：
 * - 提供用户侧的基础动作（非管理员动作）：申请加入频道、修改频道名称/简介、删除消息。
 * - 将动作的输入校验与“本地乐观更新 + 回滚”策略收敛在一处，避免 store 主文件膨胀。
 *
 * 说明：
 * - 频道管理（kick/admin/ban/applications 等）已由 `liveChatChannelAdminActions` 单独处理。
 */

import type { Ref } from "vue";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { ChannelDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatChannel, ChatMessage } from "../chatStoreTypes";

/**
 * 用户动作集合的依赖集合。
 */
export type LiveChatUserActionsDeps = {
  /**
   * chat API 端口。
   */
  api: ChatApiPort;
  /**
   * 获取当前 server socket 与可用 access token（均已 trim）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 刷新频道列表（用于动作完成后的复核）。
   */
  refreshChannels: () => Promise<void>;
  /**
   * 频道列表引用（用于写入 joinRequested/更新 name/brief）。
   */
  channelsRef: Ref<ChatChannel[]>;
  /**
   * 当前频道 id 引用（用于删除消息定位当前频道）。
   */
  currentChannelId: Ref<string>;
  /**
   * channelId → message list（用于删除消息的乐观更新与回滚）。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * UI 错误提示（删除失败时写入）。
   */
  sendError: Ref<string>;
};

/**
 * 创建 liveChat 用户动作集合。
 *
 * @param deps - 依赖集合。
 * @returns `{ applyJoin, updateChannelMeta, deleteMessage }`。
 */
export function createLiveChatUserActions(deps: LiveChatUserActionsDeps) {
  /**
   * 申请加入频道（或加入已公开频道，具体行为由服务端决定）。
   *
   * @param channelId - 目标频道 id。
   * @returns Promise<void>
   */
  async function applyJoin(channelId: string): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    const target = deps.channelsRef.value.find((c) => c.id === cid);
    if (target) target.joinRequested = true;
    try {
      await deps.api.applyJoinChannel(socket, token, cid, "");
      await deps.refreshChannels();
    } finally {
      if (target) target.joinRequested = false;
    }
  }

  /**
   * 更新频道元信息（名称/简介）。
   *
   * @param channelId - 频道 id。
   * @param patch - 要更新的部分字段。
   * @returns Promise<void>
   */
  async function updateChannelMeta(channelId: string, patch: Partial<Pick<ChatChannel, "name" | "brief">>): Promise<void> {
    const cid = String(channelId).trim();
    if (!cid) return;
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    const next: ChannelDto = await deps.api.patchChannel(socket, token, cid, { name: patch.name, brief: patch.brief });
    const ch = deps.channelsRef.value.find((c) => c.id === cid);
    if (!ch) return;
    if (typeof next.name === "string") ch.name = next.name.trim() || ch.name;
    if (typeof next.brief === "string") ch.brief = String(next.brief ?? "").trim();
  }

  /**
   * 按消息 id 硬删除消息（hard-delete）。
   *
   * 策略：
   * - 先本地移除（乐观更新），再请求服务端删除；
   * - 若服务端删除失败，则回滚本地移除并写入 `sendError`。
   *
   * @param messageId - 消息 id（mid）。
   * @returns Promise<void>
   */
  async function deleteMessage(messageId: string): Promise<void> {
    const mid = String(messageId).trim();
    if (!mid) return;
    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) return;

    const cid = deps.currentChannelId.value;
    const list = deps.messagesByChannel[cid] ?? [];
    const idx = list.findIndex((m) => m.id === mid);
    const removed = idx >= 0 ? list.splice(idx, 1)[0] : null;

    try {
      await deps.api.deleteMessage(socket, token, mid);
    } catch (e) {
      if (removed && idx >= 0) list.splice(idx, 0, removed);
      deps.sendError.value = `Delete failed: ${String(e)}`;
      throw e;
    }
  }

  return { applyJoin, updateChannelMeta, deleteMessage };
}
