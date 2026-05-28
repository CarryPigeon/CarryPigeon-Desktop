/**
 * @fileoverview useEmojiManageModel
 * @description 自定义表情管理数据模型与操作。
 */

import { ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("emoji");

export type EmojiEntry = {
  id: string;
  name: string;
  filePath: string;
  addedAt: number;
  tags: string[];
};

export function useEmojiManageModel() {
  const emojis = ref<EmojiEntry[]>([]);
  const loading = ref(false);
  const error = ref("");

  async function loadEmojis(): Promise<void> {
    loading.value = true;
    try {
      emojis.value = await invoke<EmojiEntry[]>("list_custom_emojis");
    } catch (e) {
      error.value = String(e);
      logger.error("Action: settings_emoji_load_failed", { error: String(e) });
    } finally {
      loading.value = false;
    }
  }

  async function addEmoji(sourcePath: string, name: string, tags: string[] = []): Promise<void> {
    try {
      await invoke("save_emoji", { sourcePath, name, tags });
      await loadEmojis();
    } catch (e) {
      logger.error("Action: settings_emoji_save_failed", { error: String(e) });
      throw e;
    }
  }

  async function deleteEmoji(id: string): Promise<void> {
    try {
      await invoke("delete_emoji", { id });
      await loadEmojis();
    } catch (e) {
      logger.error("Action: settings_emoji_delete_failed", { error: String(e) });
      throw e;
    }
  }

  async function getImagePath(id: string): Promise<string> {
    return invoke<string>("get_settings_emoji_image_path", { id });
  }

  onMounted(loadEmojis);

  return { emojis, loading, error, loadEmojis, addEmoji, deleteEmoji, getImagePath };
}
