<script setup lang="ts">
/**
 * @fileoverview SearchPanel.vue
 * @description 消息搜索面板独立组件，支持键盘导航与关键词高亮。
 */

import { ref, watch, nextTick, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { debounce } from "@/shared/utils/rateLimit";
import AppIcon from "@/shared/ui/AppIcon.vue";

/** 搜索结果项接口。 */
interface SearchResultItem {
  message: { id: string; from: { name: string } };
  preview: string;
  channelId?: string;
  channelName?: string;
}

const props = defineProps<{
  visible: boolean;
  loading: boolean;
  error: string | null;
  results: SearchResultItem[];
  activeIndex: number;
  query: string;
}>();

const emit = defineEmits<{
  (event: "search", query: string): void;
  (event: "navigate", index: number): void;
  (event: "close"): void;
}>();

const { t } = useI18n();

/** 内部搜索查询文本。 */
const localQuery = ref(props.query);

/** 当前激活的结果索引（内部键盘导航用）。 */
const localActiveIndex = ref(props.activeIndex);

/** 结果项 DOM 引用数组（用于滚动到视野内）。 */
const resultRefs = ref<(HTMLElement | null)[]>([]);

// 从外部 props 同步内部状态
watch(() => props.query, (v) => { localQuery.value = v; });

// 结果列表变化时重置激活索引（先于 activeIndex 同步执行，避免覆盖）
watch(() => props.results, () => {
  localActiveIndex.value = 0;
}, { deep: false });

// 从外部同步 activeIndex（在 results 之后，但仍需防覆盖）
watch(() => props.activeIndex, (v) => {
  // 仅当外部显式传入非零值且不等于当前内部值时采用，避免被结果重置覆盖
  if (v !== 0 || localActiveIndex.value === 0) {
    localActiveIndex.value = v;
  }
});

/**
 * 处理输入值变化（:value + @input 模式）。
 */
function handleInput(v: string): void {
  localQuery.value = v;
}

/**
 * 触发搜索。
 */
function handleSearch(): void {
  debouncedSearch.cancel();
  const q = localQuery.value.trim();
  if (q) emit("search", q);
}

const debouncedSearch = debounce(() => {
  handleSearch();
}, 300);

onBeforeUnmount(() => {
  debouncedSearch.cancel();
});

/**
 * 重试当前搜索。
 */
function handleRetry(): void {
  emit("search", localQuery.value);
}

/**
 * 键盘导航处理。
 */
function handleKeydown(e: KeyboardEvent): void {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (localActiveIndex.value < props.results.length - 1) {
        localActiveIndex.value++;
        scrollToActive();
      }
      break;
    case "ArrowUp":
      e.preventDefault();
      if (localActiveIndex.value > 0) {
        localActiveIndex.value--;
        scrollToActive();
      }
      break;
    case "Enter": {
      // 仅处理结果区域回车，输入框已有 @enter
      const target = e.target as HTMLElement;
      const fromInput = target.closest(".t-input") || target.tagName === "INPUT";
      if (!fromInput && props.results.length > 0) {
        e.preventDefault();
        emit("navigate", localActiveIndex.value);
      }
      break;
    }
    case "Escape":
      e.preventDefault();
      emit("close");
      break;
  }
}

/**
 * 滚动当前激活项到可见区域。
 */
function scrollToActive(): void {
  nextTick(() => {
    const el = resultRefs.value[localActiveIndex.value];
    if (el) el.scrollIntoView({ block: "nearest" });
  });
}

/**
 * 点击结果项。
 */
function handleResultClick(index: number): void {
  emit("navigate", index);
}

/**
 * 关键词高亮：对文本中匹配的关键词包裹 <mark> 标签。
 *
 * @param text - 原始文本。
 * @param keyword - 搜索关键词。
 * @returns 带有 <mark> 标签的安全 HTML 字符串。
 */
function highlightText(text: string, keyword: string): string {
  if (!keyword || !keyword.trim()) return escapeHtml(text);
  const escapedKeyword = escapeHtml(keyword.trim());
  const pattern = escapeRegex(escapedKeyword);
  const regex = new RegExp(`(${pattern})`, "gi");
  return escapeHtml(text).replace(regex, "<mark>$1</mark>");
}

/**
 * HTML 转义。
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * 正则表达式特殊字符转义。
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
</script>

<template>
  <section
    v-if="visible"
    class="cp-searchPanel"
    @keydown="handleKeydown"
  >
    <!-- 搜索栏 -->
    <div class="cp-searchPanel__row">
      <t-input
        :value="localQuery"
        :placeholder="t('search_current_channel')"
        @input="(v: string) => { handleInput(v); debouncedSearch(); }"
        @enter="handleSearch"
      />
      <button
        type="button"
        class="cp-searchPanel__close"
        :aria-label="t('close')"
        @click="emit('close')"
      >
        <AppIcon name="close" />
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="cp-searchPanel__state cp-searchPanel__state--loading">
      <AppIcon name="loading" />
      {{ t("searching") }}
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="cp-searchPanel__state cp-searchPanel__state--error">
      <span class="cp-searchPanel__errorText">{{ error }}</span>
      <button type="button" class="cp-searchPanel__retry" @click="handleRetry">
        {{ t("retry") }}
      </button>
    </div>

    <!-- 空结果状态 -->
    <div v-else-if="query && results.length === 0" class="cp-searchPanel__state cp-searchPanel__state--empty">
      {{ t("no_messages_found") }}
    </div>

    <!-- 结果列表（使用 v-else-if 防止加载中时残留旧结果） -->
    <div v-else-if="results.length > 0" class="cp-searchPanel__results" role="listbox">
      <button
        v-for="(result, index) in results"
        :key="result.message.id"
        :ref="(el: any) => { resultRefs[index] = (el as HTMLElement | null) }"
        :class="['cp-searchPanel__result', { 'cp-searchPanel__result--active': index === localActiveIndex }]"
        type="button"
        role="option"
        :aria-selected="index === localActiveIndex"
        @click="handleResultClick(index)"
      >
        <div v-if="result.channelId || result.channelName" class="cp-searchPanel__resultChannel">
          #{{ result.channelName || result.channelId }}
        </div>
        <div class="cp-searchPanel__resultSender">{{ result.message.from.name }}</div>
        <div
          class="cp-searchPanel__resultPreview"
          v-html="highlightText(result.preview, localQuery)"
        />
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* 样式：SearchPanel｜规格：聊天面板内统一工具条（字段 + 图标按钮 + 结果行） */
.cp-searchPanel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  background: var(--cp-panel-muted);
  max-height: 240px;
  overflow: hidden;
}

/* 搜索行：输入字段占满，关闭按钮为图标按钮 */
.cp-searchPanel__row {
  display: flex;
  align-items: center;
  gap: 8px;

  :deep(.t-input) {
    flex: 1 1 auto;
    min-width: 0;
  }
}

.cp-searchPanel__close {
  @include cp-icon-button;

  flex: 0 0 auto;
}

/* 状态区：错误用状态条，其余为静默说明 */
.cp-searchPanel__state {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
  padding: 2px 0;
}

.cp-searchPanel__state--loading {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-searchPanel__state--error {
  @include cp-inline-status(danger);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cp-searchPanel__state--empty {
  color: var(--cp-text-muted);
  padding: 6px 2px;
}

/* 重试：胶囊按钮（主操作语义用 highlight） */
.cp-searchPanel__retry {
  @include cp-pill-button(primary);

  min-height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
  flex: 0 0 auto;
}

/* 结果列表：工作台行列表语言 */
.cp-searchPanel__results {
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow-y: auto;
  min-height: 0;
  max-height: 160px;
}

.cp-searchPanel__result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: var(--cp-radius-sm);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: var(--cp-text);
  outline: none;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    background: var(--cp-hover-bg);
  }

  &:focus-visible {
    outline: 2px solid var(--cp-highlight-border-strong);
    outline-offset: -2px;
  }
}

/* 键盘/鼠标激活项：高亮底 + 高亮描边 + 左侧细条 */
.cp-searchPanel__result--active {
  background: var(--cp-highlight-bg);
  border-color: var(--cp-highlight-border);
  box-shadow: inset 2px 0 0 var(--cp-highlight);
}

.cp-searchPanel__resultSender {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cp-text);
}

/* 频道标签：等宽、弱化，不抢主色 */
.cp-searchPanel__resultChannel {
  font-family: var(--cp-font-mono);
  font-size: 11px;
  line-height: 1.4;
  color: var(--cp-text-muted);
  margin-bottom: 1px;
}

.cp-searchPanel__resultPreview {
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  :deep(mark) {
    background: color-mix(in oklab, var(--cp-warn) 32%, transparent);
    color: inherit;
    border-radius: 3px;
    padding: 0 1px;
  }
}
</style>
