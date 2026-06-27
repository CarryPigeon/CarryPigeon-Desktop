<script setup lang="ts">
/**
 * @fileoverview SavedMessagesPage.vue
 * @description 消息收藏列表页面：
 *   - 按时间倒序展示所有收藏消息；
 *   - 点击跳转到原频道并定位消息；
 *   - 支持移除收藏。
 */
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  loadBookmarks,
  removeBookmark,
  migrateLegacyBookmarks,
  type BookmarkEntry,
} from "../storage/localBookmarkStorage";
import AppIcon from "@/shared/ui/AppIcon.vue";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import EmptyState from "@/shared/ui/EmptyState.vue";

const { t } = useI18n();
const router = useRouter();

const bookmarks = ref<BookmarkEntry[]>([]);
const loading = ref(true);

onMounted(() => {
  migrateLegacyBookmarks();
  bookmarks.value = loadBookmarks();
  loading.value = false;
});

const sortedBookmarks = computed(() =>
  [...bookmarks.value].sort((a, b) => b.bookmarkedAt - a.bookmarkedAt),
);

/**
 * 点击某条收藏，跳转到原频道并定位消息。
 */
function handleOpenBookmark(entry: BookmarkEntry): void {
  if (entry.channelId) {
    router.push({
      path: "/chat",
      query: {
        channel: entry.channelId,
        message: entry.messageId,
      },
    });
  } else {
    router.push({
      path: "/chat",
      query: { message: entry.messageId },
    });
  }
}

/**
 * 移除单条收藏。
 */
function handleRemove(messageId: string): void {
  bookmarks.value = removeBookmark(messageId);
}

/**
 * 清空全部收藏。
 */
function handleClearAll(): void {
  bookmarks.value = [];
  localStorage.removeItem("cp_bookmarks");
}

/**
 * 格式化时间戳。
 */
function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <ErrorBoundary>
    <div class="cp-savedMessages">
      <header class="cp-savedMessages__header">
        <button class="cp-savedMessages__back" type="button" @click="router.push('/chat')">
          <t-icon name="chevron-left" /> {{ t("back") }}
        </button>
        <h1 class="cp-savedMessages__title"><AppIcon name="bookmark" :size="16" :stroke-width="1.75" /> {{ t("saved_messages") }}</h1>
        <button
          v-if="bookmarks.length > 0"
          class="cp-savedMessages__clearAll"
          type="button"
          @click="handleClearAll"
        >
          {{ t("clear_all") }}
        </button>
      </header>

      <div v-if="loading" class="cp-savedMessages__loading">
        {{ t("loading") }}...
      </div>

      <EmptyState
        v-else-if="sortedBookmarks.length === 0"
        :title="t('no_saved_messages')"
        :description="t('no_saved_messages_hint')"
      >
        <template #icon>
          <AppIcon name="bookmark" :size="40" :stroke-width="1.5" />
        </template>
      </EmptyState>

      <ul v-else class="cp-savedMessages__list">
        <li
          v-for="entry in sortedBookmarks"
          :key="entry.messageId"
          class="cp-savedMessages__item"
          role="button"
          tabindex="0"
          @click="handleOpenBookmark(entry)"
          @keydown.enter="handleOpenBookmark(entry)"
          @keydown.space.prevent="handleOpenBookmark(entry)"
        >
          <div class="cp-savedMessages__itemBody">
            <div class="cp-savedMessages__itemTop">
              <span class="cp-savedMessages__itemSender">{{ entry.senderName || t("unknown") }}</span>
              <span v-if="entry.channelName" class="cp-savedMessages__itemChannel">
                #{{ entry.channelName }}
              </span>
            </div>
            <div class="cp-savedMessages__itemPreview">
              {{ entry.contentPreview || `Message ${entry.messageId.slice(-8)}` }}
            </div>
          </div>
          <div class="cp-savedMessages__itemMeta">
            <span class="cp-savedMessages__itemTime">{{ fmtTime(entry.bookmarkedAt) }}</span>
            <button
              class="cp-savedMessages__itemRemove"
              type="button"
              :aria-label="t('remove_bookmark')"
              :title="t('remove_bookmark')"
              @click.stop="handleRemove(entry.messageId)"
            >
              <t-icon name="close" />
            </button>
          </div>
        </li>
      </ul>
    </div>
  </ErrorBoundary>
</template>

<style scoped>
.cp-savedMessages {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--cp-surface);
}

.cp-savedMessages__header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--cp-border);
  flex-shrink: 0;
}

.cp-savedMessages__back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--cp-accent);
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.1s;
}

.cp-savedMessages__back:hover {
  background: color-mix(in oklab, var(--cp-accent) 10%, transparent);
}

.cp-savedMessages__title {
  flex: 1;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--cp-text);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-savedMessages__clearAll {
  border: 1px solid var(--cp-border);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: var(--cp-danger);
  padding: 4px 12px;
  border-radius: 4px;
  transition: background-color 0.1s;
}

.cp-savedMessages__clearAll:hover {
  background: color-mix(in oklab, var(--cp-danger) 8%, transparent);
}

.cp-savedMessages__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
  flex: 1;
  color: var(--cp-text-muted);
}

.cp-savedMessages__list {
  list-style: none;
  margin: 0;
  padding: 8px;
  flex: 1;
  overflow-y: auto;
}

.cp-savedMessages__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.cp-savedMessages__item:hover {
  background: color-mix(in oklab, var(--cp-accent) 6%, transparent);
}

.cp-savedMessages__itemBody {
  flex: 1;
  min-width: 0;
}

.cp-savedMessages__itemTop {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.cp-savedMessages__itemSender {
  font-weight: 600;
  font-size: 13px;
  color: var(--cp-text);
}

.cp-savedMessages__itemChannel {
  font-size: 11px;
  color: var(--cp-accent);
  background: color-mix(in oklab, var(--cp-accent) 10%, transparent);
  padding: 1px 6px;
  border-radius: 4px;
}

.cp-savedMessages__itemPreview {
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.cp-savedMessages__itemMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.cp-savedMessages__itemTime {
  font-size: 11px;
  color: var(--cp-text-muted);
  white-space: nowrap;
}

.cp-savedMessages__itemRemove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--cp-text-muted);
  padding: 2px 4px;
  border-radius: 2px;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.cp-savedMessages__item:hover .cp-savedMessages__itemRemove {
  opacity: 1;
}

.cp-savedMessages__itemRemove:hover {
  color: var(--cp-danger);
}
</style>
