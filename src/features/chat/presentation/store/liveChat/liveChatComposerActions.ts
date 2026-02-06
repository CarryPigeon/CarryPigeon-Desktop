/**
 * @fileoverview liveChat 的 composer 行为（回复态 + 发送消息）。
 * @description chat｜展示层状态（store）：liveChatComposerActions。
 *
 * 职责：
 * - 维护“回复模式”（reply_to_mid）的进入/退出；
 * - 发送消息（Core:Text 与插件 domain 两种模式），并把新消息追加到频道消息列表；
 * - 在发送成功后尽力推进并上报读状态（节流 + 单调时间由 readStateReporter 保证）。
 *
 * 约定：
 * - 注释中文；日志英文（本模块不输出日志）。
 */

import type { Ref } from "vue";
import type { ChatApiPort } from "@/features/chat/domain/ports/chatApiPort";
import type { MessageDto, SendMessageRequestDto } from "@/features/chat/domain/types/chatWireDtos";
import type { ChatMessage, ChatStore } from "../chatStoreTypes";
import type { LiveChatReadStateReporter } from "./liveChatReadStateReporter";

type MapWireMessage = (serverSocket: string, msg: MessageDto) => ChatMessage;

/**
 * 创建 composer actions 的依赖集合。
 */
export type LiveChatComposerActionsDeps = {
  /**
   * chat HTTP API 端口。
   */
  api: ChatApiPort;
  /**
   * 获取当前 server socket 与可用 access token（均为 trim 后）。
   */
  getSocketAndValidToken: () => Promise<[string, string]>;
  /**
   * 当前频道 id（ref）。
   */
  currentChannelId: Ref<string>;
  /**
   * 消息按频道存储容器。
   */
  messagesByChannel: Record<string, ChatMessage[]>;
  /**
   * 当前选中 domain（UI）。
   */
  selectedDomainId: Ref<string>;
  /**
   * 文本输入草稿（UI）。
   */
  composerDraft: Ref<string>;
  /**
   * 回复目标消息 id（UI）。
   */
  replyToMessageId: Ref<string>;
  /**
   * 发送错误提示（UI）。
   */
  sendError: Ref<string>;
  /**
   * wire message → 展示层 message 的映射器。
   */
  mapWireMessage: MapWireMessage;
  /**
   * 读状态上报辅助。
   */
  readStateReporter: LiveChatReadStateReporter;
};

/**
 * composer 行为集合（回复态 + 发送消息）。
 */
export type LiveChatComposerActions = {
  /**
   * 进入回复模式（引用某条消息）。
   *
   * @param messageId - 要回复的消息 id。
   * @returns void。
   */
  startReply(messageId: string): void;
  /**
   * 退出回复模式（不发送）。
   *
   * @returns void。
   */
  cancelReply(): void;
  /**
   * 向当前频道发送消息。
   *
   * @param payload - 可选插件 payload。
   * @returns Promise<void>。
   */
  sendComposerMessage(payload?: Parameters<ChatStore["sendComposerMessage"]>[0]): Promise<void>;
};

/**
 * 创建 composer actions。
 *
 * @param deps - 依赖注入。
 * @returns LiveChatComposerActions。
 */
export function createLiveChatComposerActions(deps: LiveChatComposerActionsDeps): LiveChatComposerActions {
  /**
   * 进入回复模式（引用某条消息）。
   *
   * @param messageId - 要回复的消息 id。
   * @returns void。
   */
  function startReply(messageId: string): void {
    deps.replyToMessageId.value = messageId;
    deps.sendError.value = "";
  }

  /**
   * 退出回复模式（不发送）。
   *
   * @returns void。
   */
  function cancelReply(): void {
    deps.replyToMessageId.value = "";
  }

  /**
   * 生成发送消息的幂等键（用于重试去重）。
   *
   * @returns 幂等键字符串。
   */
  function createIdempotencyKey(): string {
    const v = globalThis.crypto?.randomUUID?.();
    if (typeof v === "string" && v.trim()) return v;
    return `msg_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  /**
   * 向当前频道发送消息。
   *
   * 支持两种模式：
   * - Core:Text：使用当前 `composerDraft` 作为 `{ text }` 发送。
   * - 插件模式：由插件 composer 提供完整 payload `{ domain, domain_version, data }`。
   *
   * @param payload - 可选插件 payload。
   * @returns Promise<void>。
   */
  async function sendComposerMessage(payload?: Parameters<ChatStore["sendComposerMessage"]>[0]): Promise<void> {
    const uiDomain = deps.selectedDomainId.value.trim();
    const replyToMid = deps.replyToMessageId.value.trim() || undefined;

    const isCoreText = uiDomain === "Core:Text";
    const text = deps.composerDraft.value.trim();

    if (!payload && isCoreText && !text) return;
    if (!payload && !isCoreText) {
      deps.sendError.value = "This domain requires a plugin composer.";
      return;
    }

    const [socket, token] = await deps.getSocketAndValidToken();
    if (!socket || !token) {
      deps.sendError.value = "Not signed in.";
      return;
    }

    const cid = deps.currentChannelId.value;
    if (!cid) {
      deps.sendError.value = "No channel selected.";
      return;
    }

    deps.sendError.value = "";

    const apiDomain = payload ? String(payload.domain ?? "").trim() : uiDomain;
    const apiVersion = payload ? String(payload.domain_version ?? "").trim() : "1.0.0";
    const data = payload ? payload.data : { text };
    const finalReplyToMid = payload?.reply_to_mid ? String(payload.reply_to_mid).trim() : replyToMid;
    if (!apiDomain) {
      deps.sendError.value = "Missing domain.";
      return;
    }
    if (!apiVersion) {
      deps.sendError.value = "Missing domain_version.";
      return;
    }

    try {
      const req: SendMessageRequestDto = { domain: apiDomain, domain_version: apiVersion, data, reply_to_mid: finalReplyToMid };
      const created = await deps.api.sendChannelMessage(socket, token, cid, req, createIdempotencyKey());
      const mapped = deps.mapWireMessage(socket, created);
      const list = deps.messagesByChannel[cid] ?? (deps.messagesByChannel[cid] = []);
      list.push(mapped);

      deps.replyToMessageId.value = "";
      if (!payload) deps.composerDraft.value = "";

      const now = Date.now();
      const nextReadTime = deps.readStateReporter.advanceLocalReadTime(cid, now);
      void deps.readStateReporter.reportIfAllowed(cid, mapped.id, nextReadTime, now, 1500);
    } catch (e) {
      deps.sendError.value = String(e) || "Send failed.";
      throw e;
    }
  }

  return { startReply, cancelReply, sendComposerMessage };
}
