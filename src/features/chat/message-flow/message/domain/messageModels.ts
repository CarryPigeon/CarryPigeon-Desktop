/**
 * @fileoverview message 语义模型定义。
 * @description
 * 统一描述消息外壳、内容语义与渲染模型，作为 message-flow 的稳定扩展点。
 */

import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";

/**
 * 消息 domain 描述（message 子域独立定义，避免反向依赖 presentation/store）。
 */
export type MessageDomainRef = {
  id: string;
  label: string;
  colorVar:
    | "--cp-domain-core"
    | "--cp-domain-ext-a"
    | "--cp-domain-ext-b"
    | "--cp-domain-ext-c"
    | "--cp-domain-unknown";
  pluginIdHint?: string;
  version?: string;
};

/** 消息回应 UI 摘要模型。 */
export type MessageReactionSummary = {
  emoji: string;
  count: number;
  reactedByMe: boolean;
};

/** 回复引用摘要模型。 */
export type MessageReplySummary = {
  messageId: string;
  senderName: string;
  preview: string;
  createdAt: number;
  unavailable?: boolean;
};

/** 消息提及模型。 */
export type MessageMention = {
  userId: string;
  displayName: string;
  type?: "user" | "everyone" | "here";
};

/**
 * 消息发送者最小模型。
 */
export type MessageSender = {
  id: string;
  name: string;
  /** 头像 URL（可选）。来自服务端 sender.avatar，用于 AvatarBadge 渲染。 */
  avatarUrl?: string;
};

/**
 * 消息渲染链路使用的最小消息模型。
 */
export type RenderableChatMessage =
  | {
      id: string;
      kind: "core_text";
      from: MessageSender;
      timeMs: number;
      domain: MessageDomainRef;
      text: string;
      replyToId?: string;
      replyTo?: MessageReplySummary;
      quoteReply?: {
        messageId: string;
        userId: string;
        preview: string;
      };
      mentions?: MessageMention[];
      reactions?: MessageReactionSummary[];
      forwardedFrom?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      };
      forwardedMessages?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      }[];
      recalledAt?: number;
      editedAt?: number;
      threadRootId?: string;
      threadReplyCount?: number;
      linkPreview?: ChatLinkPreview;
      status?: "sending" | "sent" | "failed";
      sendError?: string;
    }
  | {
      id: string;
      kind: "domain_message";
      from: MessageSender;
      timeMs: number;
      domain: MessageDomainRef;
      preview: string;
      data?: unknown;
      replyToId?: string;
      replyTo?: MessageReplySummary;
      quoteReply?: {
        messageId: string;
        userId: string;
        preview: string;
      };
      mentions?: MessageMention[];
      reactions?: MessageReactionSummary[];
      forwardedFrom?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      };
      forwardedMessages?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      }[];
      recalledAt?: number;
      editedAt?: number;
      threadRootId?: string;
      threadReplyCount?: number;
      linkPreview?: ChatLinkPreview;
      status?: "sending" | "sent" | "failed";
      sendError?: string;
    }
  | {
      id: string;
      kind: "image";
      from: MessageSender;
      timeMs: number;
      domain: MessageDomainRef;
      fileKey: string;
      thumbKey?: string;
      fileName: string;
      fileSize: number;
      width?: number;
      height?: number;
      mimeType: string;
      url: string;
      thumbUrl?: string;
      localPath?: string;
      replyToId?: string;
      replyTo?: MessageReplySummary;
      quoteReply?: {
        messageId: string;
        userId: string;
        preview: string;
      };
      mentions?: MessageMention[];
      reactions?: MessageReactionSummary[];
      forwardedFrom?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      };
      forwardedMessages?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      }[];
      editedAt?: number;
      recalledAt?: number;
      threadRootId?: string;
      threadReplyCount?: number;
      linkPreview?: ChatLinkPreview;
      preview: string;
      data?: unknown;
      status: "sending" | "sent" | "failed";
      sendError?: string;
    }
  | {
      id: string;
      kind: "video";
      from: MessageSender;
      timeMs: number;
      domain: MessageDomainRef;
      fileKey: string;
      thumbKey?: string;
      fileName: string;
      fileSize: number;
      width?: number;
      height?: number;
      mimeType: string;
      url: string;
      thumbUrl?: string;
      localPath?: string;
      /** 视频时长（秒）。 */
      duration?: number;
      replyToId?: string;
      replyTo?: MessageReplySummary;
      quoteReply?: {
        messageId: string;
        userId: string;
        preview: string;
      };
      mentions?: MessageMention[];
      reactions?: MessageReactionSummary[];
      forwardedFrom?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      };
      forwardedMessages?: {
        messageId: string;
        channelId: string;
        userId: string;
        preview: string;
        sentTime: number;
      }[];
      editedAt?: number;
      recalledAt?: number;
      threadRootId?: string;
      threadReplyCount?: number;
      linkPreview?: ChatLinkPreview;
      preview: string;
      data?: unknown;
      status: "sending" | "sent" | "failed";
      sendError?: string;
    };

/**
 * 消息外壳（与具体渲染形态解耦）。
 */
export type MessageEnvelope = {
  messageId: string;
  from: MessageSender;
  timeMs: number;
  domain: MessageDomainRef;
  raw: RenderableChatMessage;
};

/**
 * 消息语义模型（纯内容，不携带渲染实现）。
 */
export type MessageContentModel =
  | {
      kind: "core";
      text: string;
      replyToId?: string;
    }
  | {
      kind: "image";
      url: string;
      fileName: string;
      fileSize: number;
      preview: string;
      replyToId?: string;
    }
  | {
      kind: "video";
      url: string;
      fileName: string;
      fileSize: number;
      preview: string;
      replyToId?: string;
      duration?: number;
    }
  | {
      kind: "plugin";
      domainId: string;
      domainVersion: string;
      pluginIdHint?: string;
      preview: string;
      data?: unknown;
      replyToId?: string;
    };

/**
 * 消息渲染模型（可直接供渲染层消费）。
 */
export type MessageRenderModel =
  | {
      kind: "core";
      messageId: string;
      text: string;
      replyText?: string;
    }
  | {
      kind: "image";
      messageId: string;
      url: string;
      fileName: string;
      fileSize: number;
      preview: string;
      from: MessageSender;
      timeMs: number;
      replyToMid?: string;
    }
  | {
      kind: "video";
      messageId: string;
      url: string;
      fileName: string;
      fileSize: number;
      preview: string;
      from: MessageSender;
      timeMs: number;
      replyToMid?: string;
      duration?: number;
    }
  | {
      kind: "plugin";
      messageId: string;
      renderer: unknown;
      context: unknown;
      domainId: string;
      domainVersion: string;
      preview: string;
      data?: unknown;
      from: MessageSender;
      timeMs: number;
      replyToMid?: string;
    }
  | {
      kind: "unknown";
      domainId: string;
      domainVersion: string;
      pluginIdHint?: string;
      preview: string;
    };
