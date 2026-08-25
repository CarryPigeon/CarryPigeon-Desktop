/**
 * @fileoverview channel-discovery capability source
 * @description 把发现列表本地投影适配为稳定 capability。
 */

import { ref } from "vue";
import { clonePlainData } from "@/shared/utils/clonePlainData";
import { createWatchedSnapshotObserver } from "@/shared/utils/createWatchedSnapshotObserver";
import { IS_STORE_MOCK } from "@/shared/config/runtime";
import { getActiveChatServerSocket } from "@/features/chat/composition/serverWorkspaceAdapter";
import { ensureValidAccessToken } from "@/shared/net/auth/api";
import { readAuthToken } from "@/shared/utils/localState";
import { createHttpChannelDiscoveryApi } from "./data/httpChannelDiscoveryApi";
import { createMockChannelDiscoveryApi } from "./data/mockChannelDiscoveryApi";
import type { ChannelDiscoverItem, ChannelDiscoverPage } from "./domain/contracts";
import { ChannelDiscoveryApplicationService } from "./domain/usecases/channelDiscoveryService";
import type { ChannelDiscoveryCapabilities, ChannelDiscoverySnapshot } from "./api-types";

/**
 * 读取当前 chat 会话的 socket 与可用 token。
 */
async function getSocketAndValidToken(): Promise<[string | null, string | null]> {
  const socket = getActiveChatServerSocket().trim();
  if (!socket) return [null, null];
  const token = (await ensureValidAccessToken(socket)).trim() || readAuthToken(socket).trim();
  if (!token) return [null, null];
  return [socket, token];
}

/**
 * 创建频道发现 capability。
 */
export function createChannelDiscoveryCapabilitySource(): ChannelDiscoveryCapabilities {
  const query = ref("");
  const type = ref("");
  const items = ref<ChannelDiscoverItem[]>([]);
  const nextCursor = ref<string | undefined>(undefined);
  const hasMore = ref(false);
  const loading = ref(false);
  const error = ref("");
  const joinRequestedIds = ref<string[]>([]);

  const service = new ChannelDiscoveryApplicationService({
    api: IS_STORE_MOCK ? createMockChannelDiscoveryApi() : createHttpChannelDiscoveryApi(),
    scope: { getSocketAndValidToken },
    state: {
      readQuery: () => query.value,
      writeQuery: (value) => {
        query.value = value;
      },
      readType: () => type.value,
      writeType: (value) => {
        type.value = value;
      },
      replacePage: (page: ChannelDiscoverPage) => {
        items.value = [...page.items];
        nextCursor.value = page.nextCursor;
        hasMore.value = Boolean(page.hasMore);
      },
      appendPage: (page: ChannelDiscoverPage) => {
        items.value = [...items.value, ...page.items];
        nextCursor.value = page.nextCursor;
        hasMore.value = Boolean(page.hasMore);
      },
      setLoading: (value) => {
        loading.value = value;
      },
      setError: (value) => {
        error.value = value;
      },
      markJoinRequested: (channelId) => {
        const id = String(channelId ?? "").trim();
        if (!id || joinRequestedIds.value.includes(id)) return;
        joinRequestedIds.value = [...joinRequestedIds.value, id];
      },
      readNextCursor: () => nextCursor.value,
      readHasMore: () => hasMore.value,
      readLoading: () => loading.value,
    },
  });

  function getSnapshot(): ChannelDiscoverySnapshot {
    return {
      query: query.value,
      type: type.value,
      items: clonePlainData(items.value),
      nextCursor: nextCursor.value,
      hasMore: hasMore.value,
      loading: loading.value,
      error: error.value,
      joinRequestedIds: [...joinRequestedIds.value],
    };
  }

  const observeSnapshot = createWatchedSnapshotObserver(getSnapshot);

  return {
    getSnapshot,
    observeSnapshot,
    search: (nextQuery) => service.search(nextQuery),
    setType: (nextType) => service.setType(nextType),
    loadMore: () => service.loadMore(),
    markJoinRequested: (channelId) => service.markJoinRequested(channelId),
  };
}
