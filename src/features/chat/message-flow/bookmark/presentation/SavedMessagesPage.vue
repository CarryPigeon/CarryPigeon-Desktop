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
import PageHeader from "@/shared/ui/PageHeader.vue";
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
    <main class="cp-savedMessages">
      <!-- 区块：页面头部｜用途：返回 + 标题 + 清空操作（保留 saved-messages-back 选择器） -->
      <PageHeader
        :title="t('saved_messages')"
        back
        back-test-id="saved-messages-back"
        @back="router.push('/chat')"
      >
        <template #actions>
          <button
            v-if="bookmarks.length > 0"
            class="cp-savedMessages__clearAll"
            type="button"
            @click="handleClearAll"
          >
            {{ t("clear_all") }}
          </button>
        </template>
      </PageHeader>

      <!-- 区块：内容面板｜用途：一级玻璃面板承载收藏列表 / 空态 / 加载态 -->
      <section class="cp-savedMessages__panel">
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
                <AppIcon name="close" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </main>
  </ErrorBoundary>
</template>

<style scoped lang="scss">
/* 样式：SavedMessagesPage｜规格：工作台骨架 + PageHeader + 透明列表区域 + 紧凑行（无分隔线） */
.cp-savedMessages {
  @include cp-workspace;

  overflow: hidden;
}

/* 列表面板：共享玻璃面上的透明区域 */
.cp-savedMessages__panel {
  @include cp-region;

  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 6px;
}

/* 清空收藏：危险胶囊 */
.cp-savedMessages__clearAll {
  @include cp-pill-button(danger);
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
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* 收藏行：紧凑行 + hover 底色，行间不画分隔线 */
.cp-savedMessages__item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: var(--cp-radius-sm);
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-savedMessages__item:hover {
  background: var(--cp-hover-bg);
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

/* 频道 chip：等宽字体小胶囊 */
.cp-savedMessages__itemChannel {
  font-family: var(--cp-font-mono);
  font-size: 11px;
  color: var(--cp-text-muted);
  background: var(--cp-panel-muted);
  border: 1px solid var(--cp-border-light);
  border-radius: 999px;
  padding: 1px 8px;
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

/* 移除按钮：图标按钮规格，hover 行时才显现 */
.cp-savedMessages__itemRemove {
  @include cp-icon-button;

  width: 24px;
  height: 24px;
  opacity: 0;
  transition:
    opacity var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-savedMessages__item:hover .cp-savedMessages__itemRemove,
.cp-savedMessages__itemRemove:focus-visible {
  opacity: 1;
}

.cp-savedMessages__itemRemove:hover {
  color: var(--cp-danger);
}
</style>
