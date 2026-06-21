/**
 * @fileoverview 聊天消息模型映射与合并工具。
 * @description chat/message-flow｜application：消息模型映射与合并工具。
 */

import type { ChatMessageRecord } from "@/features/chat/domain/types/chatApiModels";
import type { ChatMessage, MessageDomain } from "@/features/chat/message-flow/domain/contracts";

type MessageModelDeps = {
  resolveDomainPluginHint(serverSocket: string, domain: string): string;
};

function mapDomainColorVar(domain: string): MessageDomain["colorVar"] {
  const d = domain.trim();
  if (d.startsWith("Core:")) return "--cp-domain-core";
  if (!d) return "--cp-domain-unknown";

  let hash = 0;
  for (let i = 0; i < d.length; i += 1) hash = (hash * 31 + d.charCodeAt(i)) >>> 0;
  const lane = hash % 3;
  if (lane === 0) return "--cp-domain-ext-a";
  if (lane === 1) return "--cp-domain-ext-b";
  return "--cp-domain-ext-c";
}

/**
 * 创建消息领域记录到展示投影的映射器。
 */
export function createMessageMapper(deps: MessageModelDeps) {
  function mapWireMessage(serverSocket: string, m: ChatMessageRecord): ChatMessage {
    const mid = String(m.id ?? "").trim() || `msg_${Date.now()}`;
    const uid = String(m.userId ?? "").trim();
    const fromName = String(m.sender?.nickname ?? "").trim() || (uid ? `u:${uid.slice(-6)}` : "Unknown");
    const fromAvatarUrl = (m.sender?.avatar ?? "").trim() || undefined;
    const timeMs = Number(m.sentTime ?? 0) || Date.now();
    const domainLabel = String(m.domain ?? "").trim() || "Unknown:Domain";
    const pluginIdHint = deps.resolveDomainPluginHint(serverSocket, domainLabel) || "";
    const domain: MessageDomain = {
      id: domainLabel,
      label: domainLabel,
      colorVar: mapDomainColorVar(domainLabel),
      pluginIdHint: pluginIdHint || undefined,
      version: String(m.domainVersion ?? "").trim() || undefined,
    };

    const replyToId = String(m.replyToMessageId ?? "").trim() || undefined;

    const replyTo = m.replyTo
      ? {
          messageId: String(m.replyTo.messageId ?? "").trim(),
          senderName: String(m.replyTo.senderName ?? "").trim() || String(m.sender?.nickname ?? "Unknown"),
          preview: String(m.replyTo.preview ?? "").trim(),
          createdAt: Number(m.replyTo.createdAt ?? 0) || 0,
          unavailable: Boolean(m.replyTo.unavailable),
        }
      : replyToId
        ? {
            messageId: replyToId,
            senderName: "Unknown",
            preview: "Original message unavailable",
            createdAt: 0,
            unavailable: true,
          }
        : undefined;

    const quoteReply = m.quoteReply
      ? {
          messageId: String(m.quoteReply.messageId ?? "").trim(),
          userId: String(m.quoteReply.userId ?? "").trim(),
          preview: String(m.quoteReply.preview ?? "").trim(),
        }
      : undefined;

    const mentions = (m.mentions ?? [])
      .map((mention) => ({
        userId: String(mention.userId ?? "").trim(),
        displayName: String(mention.displayName ?? "").trim(),
        type: mention.type,
      }))
      .filter((mention) => mention.userId);

    const forwardedFrom = m.forwardedFrom
      ? {
          messageId: String(m.forwardedFrom.messageId ?? "").trim(),
          channelId: String(m.forwardedFrom.channelId ?? "").trim(),
          userId: String(m.forwardedFrom.userId ?? "").trim(),
          preview: String(m.forwardedFrom.preview ?? "").trim(),
          sentTime: Number(m.forwardedFrom.sentTime ?? 0),
        }
      : undefined;

    const forwardedMessages = Array.isArray(m.forwardedMessages)
      ? m.forwardedMessages.map((fm) => ({
          messageId: String(fm.messageId ?? "").trim(),
          channelId: String(fm.channelId ?? "").trim(),
          userId: String(fm.userId ?? "").trim(),
          preview: String(fm.preview ?? "").trim(),
          sentTime: Number(fm.sentTime ?? 0),
        }))
      : undefined;

    function tryReadText(data: unknown): string | null {
      if (!data || typeof data !== "object") return null;
      const maybe = data as { text?: unknown };
      return typeof maybe.text === "string" ? maybe.text : null;
    }

    if (domainLabel === "Core:Text") {
      const text = tryReadText(m.data) ?? String(m.preview ?? "");

      // 检查消息是否包含文件引用标记
      const fileRefRe = /\[file:([^\]]+)\]/g;
      const fileRefs = [...text.matchAll(fileRefRe)];
      const data = (m.data ?? {}) as Record<string, unknown>;
      const attachments: unknown[] = Array.isArray(data.attachments) ? data.attachments : [];

      // 判定：消息内容仅包含 [file:xxx] 标记且附件是图片/视频 → 内联媒体消息
      if (fileRefs.length > 0 && attachments.length > 0) {
        // 查找图片和视频附件
        const mediaAtts = attachments.filter((att: unknown) => {
          const mime = String((att as Record<string, unknown>).mimeType ?? "").trim().toLowerCase();
          return mime.startsWith("image/") || mime.startsWith("video/");
        });

        // 文本中去除 [file:xxx] 标记后的剩余内容
        const cleanText = text.replace(fileRefRe, "").trim();

        // 如果文本只有文件引用（无其他内容），且恰好一个媒体附件且无非媒体附件 → 渲染为内联媒体消息。
        // 多个媒体附件或混合附件时回退到 core_text，保留 [file:xxx] 引用文本，避免丢弃附件。
        if (!cleanText && mediaAtts.length === 1 && mediaAtts.length === attachments.length) {
          const att = mediaAtts[0] as Record<string, unknown>;
          const mime = String(att.mimeType ?? "").trim().toLowerCase();
          const isVideo = mime.startsWith("video/");
          const fileName = String(att.name ?? (isVideo ? "video" : "image")).trim();
          const rawSize = att.size;
          const parsedSize = typeof rawSize === "number" && !Number.isNaN(rawSize) ? rawSize : Number(rawSize);
          const safeFileSize = Number.isFinite(parsedSize) ? Math.max(0, parsedSize) : 0;
          return {
            id: mid,
            kind: (isVideo ? "video" : "image") as "video" | "image",
            from: { id: uid, name: fromName, avatarUrl: fromAvatarUrl },
            timeMs,
            domain,
            fileKey: String(att.shareKey ?? att.key ?? fileRefs[0][1]).trim(),
            thumbKey: String(att.thumbKey ?? "").trim() || undefined,
            fileName,
            fileSize: safeFileSize,
            width: att.width != null ? Number(att.width) : undefined,
            height: att.height != null ? Number(att.height) : undefined,
            mimeType: mime,
            url: String(att.url ?? "").trim(),
            thumbUrl: String(att.thumbUrl ?? "").trim() || undefined,
            localPath: String(att.localPath ?? "").trim() || undefined,
            duration: att.duration != null
              ? (Number.isFinite(Number(att.duration)) ? Math.max(0, Number(att.duration)) : undefined)
              : undefined,
            replyToId,
            replyTo,
            quoteReply,
            mentions,
            reactions: m.reactions?.map(r => ({ emoji: r.emoji, count: r.count, reactedByMe: r.reactedByMe ?? false, })),
            forwardedFrom,
            forwardedMessages,
            preview: String(m.preview ?? "").trim() || (isVideo ? `[Video] ${fileName}` : `[Image] ${fileName}`),
            data: m.data,
            editedAt: m.editedAt != null ? Number(m.editedAt) : undefined,
            recalledAt: m.recalledAt != null ? Number(m.recalledAt) : undefined,
            threadRootId: String(m.threadRootId ?? "").trim() || undefined,
            threadReplyCount: m.threadReplyCount != null ? Number(m.threadReplyCount) : undefined,
            linkPreview: m.linkPreview ? { url: m.linkPreview.url, title: m.linkPreview.title, description: m.linkPreview.description, imageUrl: m.linkPreview.imageUrl, } : undefined,
            status: "sent" as const,
          };
        }
      }

      return { id: mid, kind: "core_text", from: { id: uid, name: fromName, avatarUrl: fromAvatarUrl }, timeMs, domain, text, replyToId, replyTo, quoteReply, mentions, forwardedFrom, forwardedMessages, reactions: m.reactions?.map(r => ({ emoji: r.emoji, count: r.count, reactedByMe: r.reactedByMe ?? false, })), editedAt: m.editedAt != null ? Number(m.editedAt) : undefined, recalledAt: m.recalledAt != null ? Number(m.recalledAt) : undefined, threadRootId: String(m.threadRootId ?? "").trim() || undefined, threadReplyCount: m.threadReplyCount != null ? Number(m.threadReplyCount) : undefined, linkPreview: m.linkPreview ? { url: m.linkPreview.url, title: m.linkPreview.title, description: m.linkPreview.description, imageUrl: m.linkPreview.imageUrl, } : undefined, status: "sent" as const, };
    }

    const preview = String(m.preview ?? "").trim() || `UNPATCHED SIGNAL · ${domainLabel}${domain.version ? `@${domain.version}` : ""}`;
    return { id: mid, kind: "domain_message", from: { id: uid, name: fromName, avatarUrl: fromAvatarUrl }, timeMs, domain, preview, data: m.data, replyToId, replyTo, quoteReply, mentions, forwardedFrom, forwardedMessages, reactions: m.reactions?.map(r => ({ emoji: r.emoji, count: r.count, reactedByMe: r.reactedByMe ?? false, })), editedAt: m.editedAt != null ? Number(m.editedAt) : undefined, recalledAt: m.recalledAt != null ? Number(m.recalledAt) : undefined, threadRootId: String(m.threadRootId ?? "").trim() || undefined, threadReplyCount: m.threadReplyCount != null ? Number(m.threadReplyCount) : undefined, linkPreview: m.linkPreview ? { url: m.linkPreview.url, title: m.linkPreview.title, description: m.linkPreview.description, imageUrl: m.linkPreview.imageUrl, } : undefined, status: "sent" as const, };
  }

  return { mapWireMessage };
}

/**
 * 比较两条消息的稳定顺序。
 *
 * 先按发送时间排序，再按消息 id 兜底，保证合并结果可重放且稳定。
 */
export function compareMessages(a: ChatMessage, b: ChatMessage): number {
  if (a.timeMs !== b.timeMs) return a.timeMs < b.timeMs ? -1 : 1;
  return a.id.localeCompare(b.id);
}

/**
 * 合并两组消息并去重。
 *
 * 使用场景：
 * - 最新页覆盖刷新；
 * - 历史分页追加；
 * - 事件流插入与已有列表对齐。
 */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const seen = new Set<string>();
  const out: ChatMessage[] = [];
  for (const m of existing) {
    if (!m?.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  for (const m of incoming) {
    if (!m?.id) continue;
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  out.sort(compareMessages);
  return out;
}
