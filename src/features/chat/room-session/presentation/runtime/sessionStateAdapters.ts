/**
 * @fileoverview room-session runtime state adapter helpers
 * @description
 * 提供 room-session runtime 内部复用的局部状态适配器：
 * - 频道目录状态端口；
 * - 读标记状态端口。
 *
 * 这些 helper 只负责把 Vue/ref/reactive 容器映射成命名状态动作，
 * 避免 `sessionStatePorts.ts` 和 `sessionSharedContext.ts` 各自重复维护一套适配逻辑。
 */

import type { Ref } from "vue";
import type {
  SessionDirectoryStatePort,
  SessionReadMarkerStatePort,
} from "@/features/chat/room-session/domain/ports";
import type { ChatChannel } from "@/features/chat/room-session/api-types";

function clearRecord(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) delete record[key];
}

/**
 * 创建目录状态端口所需的状态容器。
 */
export type CreateSessionDirectoryStatePortDeps = {
  channelsRef: Ref<ChatChannel[]>;
};

/**
 * 将频道目录状态适配为 room-session application 端口。
 */
export function createSessionDirectoryStatePort(
  deps: CreateSessionDirectoryStatePortDeps,
): SessionDirectoryStatePort {
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
  };
}

/**
 * 创建读标记状态端口所需的状态容器。
 */
export type CreateSessionReadMarkerStatePortDeps = {
  lastReadTimeMsByChannel: Record<string, number>;
  lastReadMidByChannel: Record<string, string>;
  lastReadReportAtMsByChannel: Record<string, number>;
};

/**
 * 将读标记状态适配为 room-session application 端口。
 */
export function createSessionReadMarkerStatePort(
  deps: CreateSessionReadMarkerStatePortDeps,
): SessionReadMarkerStatePort {
  return {
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
  };
}
