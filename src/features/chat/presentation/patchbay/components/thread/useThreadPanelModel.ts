/**
 * @fileoverview useThreadPanelModel.ts
 * @description chat｜ThreadPanel 视图模型。
 */

import { ref, computed } from "vue";
import type { ChatMessageRecord, ChatMessagePage } from "@/features/chat/domain/types/chatApiModels";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("chat");

export type ThreadPanelDeps = {
  getThreadReplies(rootMessageId: string, cursor?: string): Promise<ChatMessagePage>;
  sendThreadReply(rootMessageId: string, text: string): Promise<void>;
  findMessageById(messageId: string): ChatMessageRecord | undefined;
  currentChannelId: string;
};

export function useThreadPanelModel(deps: ThreadPanelDeps) {
  const open = ref(false);
  const rootMessageId = ref("");
  const replies = ref<ChatMessageRecord[]>([]);
  const loading = ref(false);
  const draft = ref("");
  const sending = ref(false);

  const rootMessage = computed(() =>
    rootMessageId.value ? deps.findMessageById(rootMessageId.value) : undefined
  );

  async function openThread(messageId: string): Promise<void> {
    rootMessageId.value = messageId;
    replies.value = [];
    open.value = true;
    loading.value = true;
    try {
      const page = await deps.getThreadReplies(messageId);
      replies.value = page.items;
    } catch (e) {
      logger.error("Action: chat_thread_load_failed", { error: String(e) });
    } finally {
      loading.value = false;
    }
  }

  function closeThread(): void {
    open.value = false;
    rootMessageId.value = "";
    replies.value = [];
    draft.value = "";
  }

  async function sendReply(): Promise<void> {
    const text = draft.value.trim();
    if (!text || sending.value) return;
    sending.value = true;
    try {
      await deps.sendThreadReply(rootMessageId.value, text);
      draft.value = "";
    } catch (e) {
      logger.error("Action: chat_thread_reply_failed", { error: String(e) });
    } finally {
      sending.value = false;
    }
  }

  return { open, rootMessageId, rootMessage, replies, loading, draft, sending, openThread, closeThread, sendReply };
}
