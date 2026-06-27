<script setup lang="ts">
/**
 * @fileoverview StickerPickerPanel.vue
 * @description 表情选择面板：收藏 Tab（自定义表情） + Emoji Tab（标准 Unicode Emoji）。
 */

import { ref, reactive, onMounted, watch } from "vue";
import { convertFileSrc } from "@tauri-apps/api/core";
import { invokeTauri } from "@/shared/tauri/invokeClient";
import { useI18n } from "vue-i18n";
import { createLogger } from "@/shared/utils/logger";
import "emoji-picker-element";
import { uploadFile } from "@/features/chat/message-flow/upload/presentation/runtime/fileUploadStore";

const props = defineProps<{
  currentUserId: string;
}>();

const emit = defineEmits<{
  (e: "select", shareKey: string): void;
  (e: "emojiSelect", emoji: string): void;
}>();

const { t } = useI18n();
const logger = createLogger("sticker");

const activeTab = ref<"collection" | "emoji">("collection");
const customEmojis = ref<Array<{ id: string; name: string; filePath: string; isAnimated: boolean }>>([]);
const loading = ref(false);
const uploading = ref(false);

// Upload dialog state
const showUploadDialog = ref(false);
const uploadFileName = ref("");
const uploadFilePath = ref("");
const uploadTags = ref("");

async function loadEmojis(): Promise<void> {
  if (!props.currentUserId) return;
  loading.value = true;
  try {
    customEmojis.value = await invokeTauri("list_custom_emojis", { uid: props.currentUserId });
  } catch (e) {
    logger.error("Action: chat_sticker_load_failed", { error: String(e) });
  } finally {
    loading.value = false;
  }
}

onMounted(loadEmojis);

function onEmojiPickerClick(e: Event): void {
  const detail = (e as CustomEvent).detail;
  const emoji = detail?.unicode ?? "";
  if (emoji) {
    emit("emojiSelect", emoji);
  }
}

async function handleStickerClick(sticker: { id: string; name: string; filePath: string }): Promise<void> {
  try {
    const absPath = await invokeTauri<string>("get_emoji_image_path", { id: sticker.id });
    const assetUrl = convertFileSrc(absPath, "asset");
    const ext = sticker.filePath.split(".").pop()?.toLowerCase() ?? "png";
    const mimeMap: Record<string, string> = {
      gif: "image/gif", png: "image/png", apng: "image/png",
      jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif",
    };
    const mime = mimeMap[ext] || "image/png";

    const response = await fetch(assetUrl);
    const blob = await response.blob();
    const file = new File([blob], `${sticker.name}.${ext}`, { type: mime });

    const result = await uploadFile(file);
    emit("select", result.shareKey);
  } catch (e) {
    logger.error("Action: chat_sticker_select_failed", { error: String(e) });
  }
}

// Upload flow
function handleAddClick(): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/gif,image/webp,image/apng,image/avif";
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    uploadFileName.value = f.name.replace(/\.[^.]+$/, "");
    uploadTags.value = "";
    const tauriPath = (f as File & { path?: string }).path;
    if (tauriPath && !tauriPath.endsWith(f.name)) {
      // Tauri-injected absolute path (available from native file dialog)
      uploadFilePath.value = tauriPath;
    } else {
      // Fallback: read file content and write to temp via blob approach
      uploadFilePath.value = "";
      showUploadDialog.value = true;
      uploading.value = true;
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const tempPath = await invokeTauri<string>("write_temp_emoji_file", { name: f.name, data: Array.from(bytes) });
        uploadFilePath.value = tempPath;
      } catch (e) {
        logger.error("Action: chat_sticker_upload_prep_failed", { error: String(e) });
        return;
      } finally {
        uploading.value = false;
        if (!uploadFilePath.value) {
          showUploadDialog.value = false;
        }
      }
    }
    showUploadDialog.value = true;
  };
  input.click();
}

async function handleUploadConfirm(): Promise<void> {
  if (uploading.value) return;
  const name = uploadFileName.value.trim();
  if (!name || !uploadFilePath.value) return;

  uploading.value = true;
  try {
    const tags = uploadTags.value.split(",").map((s) => s.trim()).filter(Boolean);
    await invokeTauri("save_emoji", {
      sourcePath: uploadFilePath.value,
      name,
      tags,
      uid: props.currentUserId,
    });
    showUploadDialog.value = false;
    await loadEmojis();
  } catch (e) {
    logger.error("Action: chat_sticker_upload_failed", { error: String(e) });
  } finally {
    uploading.value = false;
  }
}

async function handleDeleteSticker(id: string): Promise<void> {
  try {
    await invokeTauri("delete_emoji", { id, uid: props.currentUserId });
    await loadEmojis();
  } catch (e) {
    logger.error("Action: chat_sticker_delete_failed", { error: String(e) });
  }
}

const imageUrlCache = reactive<Record<string, string>>({});

async function resolveImageUrl(id: string): Promise<string> {
  if (imageUrlCache[id]) return imageUrlCache[id];
  try {
    const absPath = await invokeTauri<string>("get_emoji_image_path", { id });
    const url = convertFileSrc(absPath, "asset");
    imageUrlCache[id] = url;
    return url;
  } catch {
    return "";
  }
}

// Resolve all image URLs when emoji list changes
watch(customEmojis, async (newEmojis) => {
  for (const e of newEmojis) {
    resolveImageUrl(e.id);
  }
}, { immediate: true });
</script>

<template>
  <div class="cp-stickerPanel">
    <div class="cp-stickerPanel__tabs">
      <button
        class="cp-stickerPanel__tab"
        :class="{ active: activeTab === 'collection' }"
        @click="activeTab = 'collection'"
      >
        {{ t("favorites") || "收藏" }}
      </button>
      <button
        class="cp-stickerPanel__tab"
        :class="{ active: activeTab === 'emoji' }"
        @click="activeTab = 'emoji'"
      >
        Emoji
      </button>
    </div>

    <!-- 收藏 Tab -->
    <div v-if="activeTab === 'collection'" class="cp-stickerPanel__body">
      <div v-if="loading" class="cp-stickerPanel__loading">{{ t("loading") }}</div>
      <div v-else class="cp-stickerPanel__grid">
        <button
          v-for="sticker in customEmojis"
          :key="sticker.id"
          class="cp-stickerPanel__sticker"
          :title="`:${sticker.name}:`"
          @click="handleStickerClick(sticker)"
          @contextmenu.prevent="handleDeleteSticker(sticker.id)"
        >
          <img
            :src="imageUrlCache[sticker.id] || ''"
            :alt="sticker.name"
            class="cp-stickerPanel__img"
          />
        </button>
        <button class="cp-stickerPanel__addBtn" @click="handleAddClick">
          <span class="cp-stickerPanel__addIcon">+</span>
          <span class="cp-stickerPanel__addLabel">{{ t("add_emoji") || "添加表情" }}</span>
        </button>
      </div>
    </div>

    <!-- Emoji Tab -->
    <div v-else class="cp-stickerPanel__body">
      <emoji-picker data-source="/emoji-data.json" @emoji-click="onEmojiPickerClick"></emoji-picker>
    </div>

    <!-- Upload Dialog -->
    <teleport to="body">
      <div v-if="showUploadDialog" class="cp-stickerDialog__backdrop" @click.self="showUploadDialog = false">
        <div class="cp-stickerDialog">
          <h3 class="cp-stickerDialog__title">{{ t("add_emoji") || "添加表情" }}</h3>
          <div class="cp-stickerDialog__field">
            <label class="cp-stickerDialog__label">{{ t("emoji_name") || "表情名称" }}</label>
            <input v-model="uploadFileName" class="cp-stickerDialog__input" />
          </div>
          <div class="cp-stickerDialog__field">
            <label class="cp-stickerDialog__label">{{ t("emoji_tags") || "标签（逗号分隔）" }}</label>
            <input v-model="uploadTags" class="cp-stickerDialog__input" />
          </div>
          <div class="cp-stickerDialog__actions">
            <button class="cp-stickerDialog__btn" @click="showUploadDialog = false">{{ t("cancel") || "取消" }}</button>
            <button class="cp-stickerDialog__btn cp-stickerDialog__btn--primary" :disabled="uploading" @click="handleUploadConfirm">
              {{ uploading ? (t("uploading") || "上传中...") : (t("confirm") || "确认") }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.cp-stickerPanel {
  width: 360px;
  background: var(--cp-panel);
  border-radius: 12px;
  border: 1px solid var(--cp-border);
  overflow: hidden;
}

.cp-stickerPanel__tabs {
  display: flex;
  gap: 4px;
  padding: 8px 8px 0;
}

.cp-stickerPanel__tab {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: transparent;
  color: var(--cp-text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: background var(--cp-fast) var(--cp-ease), color var(--cp-fast) var(--cp-ease);
}

.cp-stickerPanel__tab.active {
  background: var(--cp-accent);
  color: #fff;
  border-color: var(--cp-accent);
}

.cp-stickerPanel__body {
  padding: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.cp-stickerPanel__loading {
  text-align: center;
  color: var(--cp-text-secondary);
  font-size: 13px;
  padding: 20px;
}

.cp-stickerPanel__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.cp-stickerPanel__sticker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 1;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  padding: 4px;
  transition: background var(--cp-fast) var(--cp-ease);
}

.cp-stickerPanel__sticker:hover {
  background: var(--cp-hover-bg);
}

.cp-stickerPanel__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.cp-stickerPanel__addBtn {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px dashed var(--cp-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  color: var(--cp-text-muted);
  font-size: 11px;
  transition: border-color 0.15s, color 0.15s;
}

.cp-stickerPanel__addBtn:hover {
  border-color: var(--cp-accent);
  color: var(--cp-accent);
}

.cp-stickerPanel__addIcon {
  font-size: 20px;
  line-height: 1;
}

.cp-stickerPanel__addLabel {
  font-size: 11px;
}

/* Upload dialog */
.cp-stickerDialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cp-stickerDialog {
  background: var(--cp-panel);
  border-radius: 16px;
  padding: 20px 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.cp-stickerDialog__title {
  font-size: 16px;
  color: var(--cp-text);
  margin: 0 0 16px;
}

.cp-stickerDialog__field {
  margin-bottom: 12px;
}

.cp-stickerDialog__label {
  display: block;
  font-size: 12px;
  color: var(--cp-text-secondary);
  margin-bottom: 4px;
}

.cp-stickerDialog__input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 13px;
  box-sizing: border-box;
}

.cp-stickerDialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.cp-stickerDialog__btn {
  padding: 8px 16px;
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 13px;
  cursor: pointer;
}

.cp-stickerDialog__btn--primary {
  background: var(--cp-accent);
  color: white;
  border-color: var(--cp-accent);
}

.cp-stickerDialog__btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
