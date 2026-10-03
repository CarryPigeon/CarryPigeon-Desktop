/**
 * @fileoverview useChannelPinStore.ts
 * @description chat｜本地置顶频道状态管理：通过 Tauri 读写本机 JSON，并订阅文件变更热加载。
 */

import { ref, type Ref } from "vue";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { createLogger } from "@/shared/utils/logger";
import {
  listenChannelPinsFileChanged,
  loadChannelPins,
  toggleChannelPinned,
  type ChannelPinsState,
} from "@/features/chat/channel-pins/data/localChannelPinsData";

const logger = createLogger("channelPinStore");

/**
 * 置顶频道状态管理接口。
 */
export type ChannelPinStore = {
  /** serverSocket -> 置顶频道 ID 列表（有序）。 */
  pinnedByServer: Ref<Record<string, readonly string[]>>;
  /** 查询指定服务器下某频道是否已置顶。 */
  isPinned(serverSocket: string, channelId: string): boolean;
  /** 返回指定服务器下的置顶频道 ID 顺序列表。 */
  pinnedIds(serverSocket: string): readonly string[];
  /** 切换置顶状态并持久化到本机 JSON。 */
  togglePin(serverSocket: string, channelId: string): Promise<void>;
  /** 重新从本机文件加载。 */
  refresh(): Promise<void>;
  /** 加载并订阅文件热加载事件（幂等）。 */
  start(): Promise<void>;
  /** 取消文件热加载订阅。 */
  stop(): void;
};

let storeInstance: ChannelPinStore | null = null;

/**
 * 创建（或获取）置顶频道状态 store。
 *
 * 单例模式：整个 patchbay 共享同一份状态。
 */
export function useChannelPinStore(): ChannelPinStore {
  if (storeInstance) return storeInstance;

  const pinnedByServer = ref<Record<string, readonly string[]>>({});
  let unlisten: UnlistenFn | null = null;
  let starting: Promise<void> | null = null;

  function applyState(state: ChannelPinsState): void {
    pinnedByServer.value = state.servers;
  }

  function pinnedIds(serverSocket: string): readonly string[] {
    if (!serverSocket) return [];
    return pinnedByServer.value[serverSocket] ?? [];
  }

  function isPinned(serverSocket: string, channelId: string): boolean {
    if (!serverSocket || !channelId) return false;
    return pinnedIds(serverSocket).includes(channelId);
  }

  async function refresh(): Promise<void> {
    try {
      applyState(await loadChannelPins());
    } catch (error) {
      logger.warn("Action: chat_channel_pins_load_failed", { error: String(error) });
    }
  }

  async function start(): Promise<void> {
    if (unlisten || starting) {
      await starting;
      return;
    }
    starting = (async () => {
      await refresh();
      try {
        unlisten = await listenChannelPinsFileChanged((state) => {
          applyState(state);
          logger.info("Action: chat_channel_pins_hot_reloaded");
        });
      } catch (error) {
        logger.warn("Action: chat_channel_pins_subscribe_failed", { error: String(error) });
      }
    })().finally(() => {
      starting = null;
    });
    await starting;
  }

  function stop(): void {
    unlisten?.();
    unlisten = null;
  }

  async function togglePin(serverSocket: string, channelId: string): Promise<void> {
    if (!serverSocket || !channelId) return;
    try {
      applyState(await toggleChannelPinned(serverSocket, channelId));
    } catch (error) {
      logger.error("Action: chat_channel_pin_toggle_failed", {
        serverSocket,
        channelId,
        error: String(error),
      });
      throw error;
    }
  }

  storeInstance = {
    pinnedByServer,
    isPinned,
    pinnedIds,
    togglePin,
    refresh,
    start,
    stop,
  };
  return storeInstance;
}
