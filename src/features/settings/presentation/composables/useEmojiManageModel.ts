/**
 * @fileoverview useEmojiManageModel
 * @description 自定义表情管理数据模型与操作。
 */

import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("emoji");

export type EmojiEntry = {
  id: string;
  name: string;
  filePath: string;
  addedAt: number;
  tags: string[];
  ownerUid: string;
  isAnimated: boolean;
};

export function useEmojiManageModel() {
  const emojis = ref<EmojiEntry[]>([]);
  const loading = ref(false);
  const error = ref("");

  async function loadEmojis(uid: string): Promise<void> {
    if (!uid) return;
    loading.value = true;
    try {
      emojis.value = await invoke<EmojiEntry[]>(TAURI_COMMANDS.listCustomEmojis, { uid });
    } catch (e) {
      error.value = String(e);
      logger.error("Action: chat_emoji_load_failed", { error: String(e) });
    } finally {
      loading.value = false;
    }
  }

  async function addEmoji(sourcePath: string, name: string, tags: string[] = [], uid: string): Promise<void> {
    try {
      await invoke(TAURI_COMMANDS.saveEmoji, { sourcePath, name, tags, uid });
      await loadEmojis(uid);
    } catch (e) {
      logger.error("Action: chat_emoji_save_failed", { error: String(e) });
      throw e;
    }
  }

  async function deleteEmoji(id: string, uid: string): Promise<void> {
    try {
      await invoke(TAURI_COMMANDS.deleteEmoji, { id, uid });
      await loadEmojis(uid);
    } catch (e) {
      logger.error("Action: chat_emoji_delete_failed", { error: String(e) });
      throw e;
    }
  }

  async function getImagePath(id: string): Promise<string> {
    return invoke<string>(TAURI_COMMANDS.getEmojiImagePath, { id });
  }

  return { emojis, loading, error, loadEmojis, addEmoji, deleteEmoji, getImagePath };
}
