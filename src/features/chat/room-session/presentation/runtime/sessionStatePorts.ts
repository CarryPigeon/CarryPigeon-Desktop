/**
 * @fileoverview room-session runtime state -> application port adapters
 * @description
 * 把 room-session runtime 使用的 Vue/ref/reactive 状态容器适配为
 * application 层可消费的显式状态端口。
 */

import type { Ref } from "vue";
import type { ChannelUnreadProjectionPort } from "@/features/chat/message-flow/application/ports";
import type { RoomSessionStatePort } from "@/features/chat/room-session/application/ports/sessionPorts";
import type { ChatMember } from "@/features/chat/room-governance/api-types";
import type { ChatMessage, ChatMessageActionErrorInfo } from "@/features/chat/message-flow/api-types";
import type { ChatChannel } from "@/features/chat/room-session/api-types";

function clearRecord(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) delete record[key];
}

export type CreateRoomSessionStatePortDeps = {
  channelsRef: Ref<ChatChannel[]>;
  currentChannelId: Ref<string>;
  members: Ref<ChatMember[]>;
  messagesByChannel: Record<string, ChatMessage[]>;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
  lastReadReportAtMsByChannel: Record<string, number>;
  nextCursorByChannel: Record<string, string>;
  hasMoreByChannel: Record<string, boolean>;
  loadingMoreByChannel: Record<string, boolean>;
  scopeVersion: Ref<number>;
  messageActionError: Ref<ChatMessageActionErrorInfo | null>;
  composerDraft: Ref<string>;
  replyToMessageId: Ref<string>;
  selectedDomainId: Ref<string>;
};

export function createRoomSessionStatePort(
  deps: CreateRoomSessionStatePortDeps,
): RoomSessionStatePort {
  return {
    listChannels(): readonly ChatChannel[] {
      return deps.channelsRef.value;
    },
    findChannelById(channelId: string): Readonly<ChatChannel> | null {
      return deps.channelsRef.value.find((entry) => entry.id === channelId) ?? null;
    },
    replaceChannels(channels: readonly ChatChannel[]): void {
      deps.channelsRef.value = [...channels];
    },
    readUnreadCount(channelId: string): number {
      return deps.channelsRef.value.find((entry) => entry.id === channelId)?.unread ?? 0;
    },
    markChannelReadLocally(channelId: string): void {
      const channel = deps.channelsRef.value.find((entry) => entry.id === channelId);
      if (channel) channel.unread = 0;
    },
    incrementChannelUnread(channelId: string, delta: number = 1): void {
      const channel = deps.channelsRef.value.find((entry) => entry.id === channelId);
      if (!channel) return;
      channel.unread = Math.max(0, channel.unread + Math.max(0, Math.trunc(delta)));
    },
    clearChannelDirectory(): void {
      deps.channelsRef.value = [];
    },
    readCurrentChannelId(): string {
      return deps.currentChannelId.value.trim();
    },
    setCurrentChannelId(channelId: string): void {
      deps.currentChannelId.value = channelId;
    },
    setCurrentChannelIdIfEmpty(): void {
      if (!deps.currentChannelId.value) deps.currentChannelId.value = deps.channelsRef.value[0]?.id ?? "";
    },
    clearCurrentChannel(): void {
      deps.currentChannelId.value = "";
    },
    listMessages(channelId: string): readonly ChatMessage[] {
      return deps.messagesByChannel[channelId] ?? [];
    },
    findMessageById(channelId: string, messageId: string): ChatMessage | null {
      const list = deps.messagesByChannel[channelId] ?? [];
      return list.find((entry) => entry.id === messageId) ?? null;
    },
    clearAllMessageCaches(): void {
      clearRecord(deps.messagesByChannel);
    },
    readLastReadTimeMs(channelId: string): number {
      return Number(deps.lastReadTimeMsByChannel[channelId] ?? 0);
    },
    writeLastReadTimeMs(channelId: string, timeMs: number): void {
      deps.lastReadTimeMsByChannel[channelId] = timeMs;
    },
    readLastReadMessageId(channelId: string): string {
      return String(deps.lastReadMidByChannel[channelId] ?? "");
    },
    writeLastReadMessageId(channelId: string, messageId: string): void {
      deps.lastReadMidByChannel[channelId] = messageId;
    },
    readLastReportAtMs(channelId: string): number {
      return Number(deps.lastReadReportAtMsByChannel[channelId] ?? 0);
    },
    writeLastReportAtMs(channelId: string, timeMs: number): void {
      deps.lastReadReportAtMsByChannel[channelId] = timeMs;
    },
    clearAllReadMarkers(): void {
      clearRecord(deps.lastReadTimeMsByChannel);
      clearRecord(deps.lastReadMidByChannel);
      clearRecord(deps.lastReadReportAtMsByChannel);
    },
    listMembers(): readonly ChatMember[] {
      return deps.members.value;
    },
    clearMembers(): void {
      deps.members.value = [];
    },
    clearPaginationState(): void {
      clearRecord(deps.nextCursorByChannel);
      clearRecord(deps.hasMoreByChannel);
      clearRecord(deps.loadingMoreByChannel);
    },
    clearMessageActionState(): void {
      deps.messageActionError.value = null;
    },
    resetComposerState(): void {
      deps.composerDraft.value = "";
      deps.replyToMessageId.value = "";
      deps.selectedDomainId.value = "Core:Text";
    },
    incrementScopeVersion(): void {
      deps.scopeVersion.value += 1;
    },
  };
}

export type CreateSessionUnreadProjectionPortDeps = {
  channelsRef: Ref<ChatChannel[]>;
};

export function createSessionUnreadProjectionPort(
  deps: CreateSessionUnreadProjectionPortDeps,
): ChannelUnreadProjectionPort {
  return {
    incrementChannelUnread(channelId: string, delta: number = 1): void {
      const channel = deps.channelsRef.value.find((entry) => entry.id === channelId);
      if (!channel) return;
      channel.unread = Math.max(0, channel.unread + Math.max(0, Math.trunc(delta)));
    },
  };
}

export type CreateSessionReadStateEventProjectionPortDeps = {
  channelsRef: Ref<ChatChannel[]>;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
};

export function createSessionReadStateEventProjectionPort(
  deps: CreateSessionReadStateEventProjectionPortDeps,
): Pick<
  RoomSessionStatePort,
  | "readLastReadTimeMs"
  | "readLastReadMessageId"
  | "writeLastReadTimeMs"
  | "writeLastReadMessageId"
  | "markChannelReadLocally"
> {
  return {
    readLastReadTimeMs(channelId: string): number {
      return Number(deps.lastReadTimeMsByChannel[channelId] ?? 0);
    },
    readLastReadMessageId(channelId: string): string {
      return String(deps.lastReadMidByChannel[channelId] ?? "");
    },
    writeLastReadTimeMs(channelId: string, timeMs: number): void {
      deps.lastReadTimeMsByChannel[channelId] = timeMs;
    },
    writeLastReadMessageId(channelId: string, messageId: string): void {
      deps.lastReadMidByChannel[channelId] = messageId;
    },
    markChannelReadLocally(channelId: string): void {
      const channel = deps.channelsRef.value.find((entry) => entry.id === channelId);
      if (channel) channel.unread = 0;
    },
  };
}
