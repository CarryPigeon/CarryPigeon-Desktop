/**
 * @fileoverview chat｜presentation composable：插件 host bridge 编排。
 * @description 管理 host bridge 注入/卸载生命周期。
 */

import { computed, type ComputedRef, type Ref } from "vue";
import type { ComposerSubmitPayload, SendChatMessageOutcome } from "@/features/chat/message-flow/api-types";
import {
  attachChatPluginHostBridge as attachPluginHostBridgeInternal,
  detachChatPluginHostBridge as detachPluginHostBridgeInternal,
  type PluginComposerPayload,
} from "@/features/chat/data/plugin-runtime";

type RefLike<T> = Ref<T> | ComputedRef<T>;

export type UsePluginHostBridgeDeps = {
  socket: RefLike<string>;
  currentChannelId: RefLike<string>;
  sendComposerMessage(payload: ComposerSubmitPayload): Promise<SendChatMessageOutcome>;
};

/**
 * 插件 host bridge 编排：
 * - 解析当前 socket 对应的插件运行时视图
 * - 注入/卸载 host bridge（避免 registry 直接依赖 chat store）
 */
export function usePluginHostBridge(deps: UsePluginHostBridgeDeps) {
  const serverSocket = computed(() => String(deps.socket.value ?? "").trim());

  function attachPluginHostBridge(): void {
    if (!serverSocket.value) return;
    attachPluginHostBridgeInternal(serverSocket.value, {
      getCid() {
        return deps.currentChannelId.value;
      },
      async sendMessage(payload: PluginComposerPayload) {
        await deps.sendComposerMessage({
          domain: payload.domain,
          domainVersion: String(payload.domainVersion ?? "").trim(),
          data: payload.data,
          replyToMessageId: String(payload.replyToMessageId ?? "").trim() || undefined,
        });
      },
    });
  }

  function detachPluginHostBridge(): void {
    if (!serverSocket.value) return;
    detachPluginHostBridgeInternal(serverSocket.value);
  }

  return {
    attachPluginHostBridge,
    detachPluginHostBridge,
  };
}
