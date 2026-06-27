<script setup lang="ts">
/**
 * @fileoverview EmojiManagePage.vue
 * @description 自定义表情管理页面：添加 / 删除 / 展示。
 */

import { ref, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useEmojiManageModel } from "../composables/useEmojiManageModel";
import { createLogger } from "@/shared/utils/logger";
import { getAccountCapabilities } from "@/features/account/api";
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';

const logger = createLogger("emoji");

const accountCapabilities = getAccountCapabilities();
function getCurrentChatUserId(): string {
  return accountCapabilities.currentUser.getSnapshot().id;
}

const { t } = useI18n();
const { emojis, loading, loadEmojis, addEmoji, deleteEmoji, getImagePath } = useEmojiManageModel();

const nameInput = ref("");
const tagsInput = ref("");
const adding = ref(false);

// 监听用户 ID 变化，自动加载表情
watch(() => getCurrentChatUserId(), (newUid) => {
  if (newUid) {
    loadEmojis(newUid);
  }
}, { immediate: true });

/**
 * 图片路径缓存：id -> 可显示的 asset URL
 * 使用 reactive 对象而非 ref<Map> 以确保模板中读取时触发响应式追踪。
 */
const imagePaths = reactive<Record<string, string>>({});

/**
 * 将后端返回的绝对路径转换为 asset:// 协议的 URL，供 <img> 使用。
 */
async function resolveImagePath(id: string): Promise<string> {
  if (imagePaths[id]) return imagePaths[id];
  try {
    const path = await getImagePath(id);
    const assetUrl = convertFileSrc(path, "asset");
    imagePaths[id] = assetUrl;
    return assetUrl;
  } catch (e) {
    logger.error("Action: chat_emoji_resolve_image_failed", { id, error: String(e) });
    return "";
  }
}

// 当表情列表加载完成后，解析每个表情的图片路径
watch(emojis, async (newEmojis) => {
  for (const e of newEmojis) {
    resolveImagePath(e.id);
  }
}, { immediate: true });

/**
 * 文件选择处理。
 * 优先尝试 Tauri 的 dialog 插件；不可用时回退到 <input type="file">。
 * 注意：<input type="file"> 只能拿到文件名和 File 对象，无法提供完整文件系统路径；
 * 因此优先使用 dialog 插件以获得本地路径。
 */
async function handleFileSelect(): Promise<void> {
  const filePath = await fallbackFileSelect();

  if (!filePath) return;

  adding.value = true;
  try {
    const name = nameInput.value.trim() || extractNameFromPath(filePath);
    const tags = tagsInput.value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await addEmoji(filePath, name, tags, getCurrentChatUserId());
    nameInput.value = "";
    tagsInput.value = "";
  } catch (e) {
    logger.error("Action: chat_emoji_add_failed", { error: String(e) });
  } finally {
    adding.value = false;
  }
}

async function handleDelete(id: string): Promise<void> {
  try {
    await deleteEmoji(id, getCurrentChatUserId());
  } catch (e) {
    logger.error("Action: chat_emoji_delete_failed", { error: String(e) });
  }
}

/**
 * 回退方案：使用隐藏的 <input type="file"> 选择文件。
 * 注意：此方案在 Tauri WebView 中可能无法返回真实路径。
 */
function fallbackFileSelect(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/gif,image/webp,image/jpeg,image/apng,image/avif";
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) {
        // Tauri 环境下，File 对象可能带有 path 属性（由 Tauri 注入）
        const path = (file as File & { path?: string }).path || file.name;
        resolve(path);
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * 从文件路径中提取不带扩展名的文件名作为表情名称。
 */
function extractNameFromPath(filePath: string): string {
  const segments = filePath.replace(/\\/g, "/").split("/");
  const fileName = segments[segments.length - 1] || "emoji";
  return fileName.replace(/\.[^.]+$/, "");
}
</script>

<template>
  <ErrorBoundary>
    <div class="cp-emojiManage">
      <h2 class="cp-emojiManage__title">{{ t("custom_emoji") }}</h2>

      <div class="cp-emojiManage__add">
        <input
          v-model="nameInput"
          :placeholder="t('emoji_name')"
          class="cp-emojiManage__input"
        />
        <input
          v-model="tagsInput"
          :placeholder="t('emoji_tags')"
          class="cp-emojiManage__input"
        />
        <button
          class="cp-emojiManage__btn"
          :disabled="adding"
          @click="handleFileSelect"
        >
          {{ adding ? t("loading") : t("add_emoji") }}
        </button>
      </div>

      <div v-if="loading" class="cp-emojiManage__loading">
        {{ t("loading") }}
      </div>

      <div v-else class="cp-emojiManage__grid">
        <div
          v-for="emoji in emojis"
          :key="emoji.id"
          class="cp-emojiManage__item"
        >
          <img
            v-if="imagePaths[emoji.id]"
            :src="imagePaths[emoji.id]"
            :alt="emoji.name"
            class="cp-emojiManage__img"
          />
          <div
            v-else
            class="cp-emojiManage__imgPlaceholder"
          >
            {{ emoji.name.charAt(0) }}
          </div>
          <div class="cp-emojiManage__name">{{ emoji.name }}</div>
          <button
            class="cp-emojiManage__del"
            :title="t('delete')"
            @click="handleDelete(emoji.id)"
          >
            &times;
          </button>
        </div>

        <div
          v-if="emojis.length === 0"
          class="cp-emojiManage__empty"
        >
          {{ t("no_custom_emojis") }}
        </div>
      </div>
    </div>
  </ErrorBoundary>
</template>

<style scoped lang="scss">
.cp-emojiManage {
  padding: 14px;
}

.cp-emojiManage__title {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--cp-text);
}

.cp-emojiManage__add {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.cp-emojiManage__input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-panel);
  color: var(--cp-text);
  font-size: 13px;
}

.cp-emojiManage__btn {
  padding: 8px 16px;
  border-radius: var(--cp-radius-sm);
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.cp-emojiManage__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-emojiManage__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.cp-emojiManage__item {
  position: relative;
  text-align: center;
  padding: 8px;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius);
}

.cp-emojiManage__img {
  width: 48px;
  height: 48px;
  object-fit: contain;
}

.cp-emojiManage__imgPlaceholder {
  width: 48px;
  height: 48px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--cp-panel-muted);
  border-radius: var(--cp-radius-sm);
  font-size: 20px;
  color: var(--cp-text-muted);
}

.cp-emojiManage__name {
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-emojiManage__del {
  position: absolute;
  top: 4px;
  right: 4px;
  border: none;
  background: var(--cp-hover-bg);
  color: var(--cp-danger);
  cursor: pointer;
  font-size: 16px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.cp-emojiManage__del:hover {
  background: var(--cp-danger);
  color: white;
}

.cp-emojiManage__empty {
  color: var(--cp-text-muted);
  font-size: 13px;
  text-align: center;
  grid-column: 1 / -1;
  padding: 24px;
}

.cp-emojiManage__loading {
  color: var(--cp-text-muted);
  text-align: center;
  padding: 24px;
}
</style>
