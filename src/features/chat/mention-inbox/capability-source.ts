/**
 * @fileoverview mention-inbox capability source。
 */

import { ref } from "vue";
import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { readAuthToken } from "@/shared/utils/localState";
import { getRoomSessionCapabilities } from "@/features/chat/room-session/api";
import { createMentionInboxApi } from "./data/mentionInboxApi";
import type { MentionInboxItem } from "./domain/contracts";
import { MentionInboxApplicationService } from "./domain/usecases/mentionInboxService";
import type { MentionInboxCapabilities, MentionInboxSnapshot } from "./api-types";

async function getSocketAndValidToken(): Promise<[string | null, string | null]> {
  const socket = getActiveChatServerSocket().trim();
  if (!socket) return [null, null];
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  if (!token) return [null, null];
  return [socket, token];
}

/**
 * 创建提及收件箱 capability。
 */
export function createMentionInboxCapabilitySource(): MentionInboxCapabilities {
  const items = ref<MentionInboxItem[]>([]);
  const nextCursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const unreadCount = ref(0);
  const unreadHasMore = ref(false);
  const unreadOnly = ref(false);
  const channelId = ref("");
  const loading = ref(false);
  const error = ref("");

  const service = new MentionInboxApplicationService({
    api: createMentionInboxApi(),
    scope: { getSocketAndValidToken },
    state: {
      replaceItems: (next, cursor, more) => {
        items.value = [...next];
        nextCursor.value = cursor;
        hasMore.value = Boolean(more);
      },
      appendItems: (next, cursor, more) => {
        items.value = [...items.value, ...next];
        nextCursor.value = cursor;
        hasMore.value = Boolean(more);
      },
      setUnreadCount: (count, more) => {
        unreadCount.value = Math.max(0, Math.trunc(count));
        unreadHasMore.value = more;
      },
      setLoading: (value) => {
        loading.value = value;
      },
      setError: (value) => {
        error.value = value;
      },
      setUnreadOnly: (value) => {
        unreadOnly.value = value;
      },
      setChannelId: (value) => {
        channelId.value = value;
      },
      markLocalRead: (mentionId) => {
        items.value = items.value.map((row) => (row.mentionId === mentionId ? { ...row, read: true } : row));
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      },
      markAllLocalRead: () => {
        items.value = items.value.map((row) => ({ ...row, read: true }));
        unreadCount.value = 0;
        unreadHasMore.value = false;
      },
      findItem: (mentionId) => items.value.find((row) => row.mentionId === mentionId) ?? null,
      readNextCursor: () => nextCursor.value,
      readHasMore: () => hasMore.value,
      readLoading: () => loading.value,
      readUnreadOnly: () => unreadOnly.value,
      readChannelId: () => channelId.value,
    },
    navigation: {
      async selectChannel(id: string) {
        await getRoomSessionCapabilities().currentChannel.selectChannel(id);
      },
    },
  });

  function getSnapshot(): MentionInboxSnapshot {
    return {
      items: clonePlainData(items.value),
      unreadCount: unreadCount.value,
      unreadHasMore: unreadHasMore.value,
      unreadOnly: unreadOnly.value,
      channelId: channelId.value,
      hasMore: hasMore.value,
      loading: loading.value,
      error: error.value,
    };
  }

  return {
    getSnapshot,
    observeSnapshot: createWatchedSnapshotObserver(getSnapshot),
    refresh: () => service.refresh(),
    loadMore: () => service.loadMore(),
    setUnreadOnly: (value) => service.setUnreadOnly(value),
    setChannelId: (id) => service.setChannelId(id),
    markRead: (mentionId) => service.markRead(mentionId),
    markAllRead: () => service.markAllRead(),
    openMention: (mentionId) => service.openMention(mentionId),
  };
}
