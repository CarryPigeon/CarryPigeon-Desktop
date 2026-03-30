/**
 * @fileoverview room-session runtime state -> application port adapters
 * @description
 * 把 room-session runtime 使用的 Vue/ref/reactive 状态容器适配为
 * application 层可消费的显式状态端口。
 */

import type { Ref } from "vue";
import type { ChannelUnreadProjectionPort } from "@/features/chat/message-flow/domain/ports";
import type {
  RoomSessionStatePort,
  SessionDirectoryStatePort,
  SessionReadMarkerStatePort,
} from "@/features/chat/room-session/domain/ports";
import type { ChatMember } from "@/features/chat/room-governance/api-types";
import type { ChatMessage, ChatMessageActionErrorInfo } from "@/features/chat/message-flow/api-types";
import type { ChatChannel } from "@/features/chat/room-session/api-types";
import {
  createSessionDirectoryStatePort,
  createSessionReadMarkerStatePort,
} from "./sessionStateAdapters";

function clearRecord(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) delete record[key];
}

/**
 * 创建 room-session 状态端口所需的底层状态容器。
 */
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

/**
 * 将 room-session runtime 状态适配为 application 层状态端口。
 */
export function createRoomSessionStatePort(
  deps: CreateRoomSessionStatePortDeps,
): RoomSessionStatePort {
  const directoryState = createSessionDirectoryStatePort({
    channelsRef: deps.channelsRef,
  });
  const readMarkerState = createSessionReadMarkerStatePort({
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
    lastReadMidByChannel: deps.lastReadMidByChannel,
    lastReadReportAtMsByChannel: deps.lastReadReportAtMsByChannel,
  });

  return {
    ...directoryState,
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
    ...readMarkerState,
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

/**
 * 创建未读计数投影端口所需的状态容器。
 */
export type CreateSessionUnreadProjectionPortDeps = {
  channelsRef: Ref<ChatChannel[]>;
};

/**
 * 创建仅负责未读投影的局部状态端口。
 */
export function createSessionUnreadProjectionPort(
  deps: CreateSessionUnreadProjectionPortDeps,
): ChannelUnreadProjectionPort {
  const directoryState: Pick<SessionDirectoryStatePort, "incrementChannelUnread"> = createSessionDirectoryStatePort({
    channelsRef: deps.channelsRef,
  });
  return directoryState;
}

/**
 * 创建 `read_state.updated` 事件投影端口所需的状态容器。
 */
export type CreateSessionReadStateEventProjectionPortDeps = {
  channelsRef: Ref<ChatChannel[]>;
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
};

/**
 * 创建仅供 read-state 事件路由器使用的局部投影端口。
 */
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
  const directoryState: Pick<SessionDirectoryStatePort, "markChannelReadLocally"> = createSessionDirectoryStatePort({
    channelsRef: deps.channelsRef,
  });
  const readMarkerState: Pick<
    SessionReadMarkerStatePort,
    | "readLastReadTimeMs"
    | "readLastReadMessageId"
    | "writeLastReadTimeMs"
    | "writeLastReadMessageId"
  > = createSessionReadMarkerStatePort({
    lastReadTimeMsByChannel: deps.lastReadTimeMsByChannel,
    lastReadMidByChannel: deps.lastReadMidByChannel,
    lastReadReportAtMsByChannel: {},
  });
  return {
    ...readMarkerState,
    ...directoryState,
  };
}
