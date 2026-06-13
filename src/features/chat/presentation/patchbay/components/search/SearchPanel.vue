<script setup lang="ts">
/**
 * @fileoverview SearchPanel.vue
 * @description 消息搜索面板独立组件，支持键盘导航与关键词高亮。
 */

import { ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";

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
  scope: "channel" | "server";
}>();

const emit = defineEmits<{
  (event: "search", query: string): void;
  (event: "update:scope", scope: "channel" | "server"): void;
  (event: "navigate", index: number): void;
  (event: "close"): void;
}>();

const { t } = useI18n();

/** 搜索范围选项。 */
const scopeOptions = [
  { label: "当前频道", value: "channel" },
  { label: "全部频道", value: "server" },
];

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
  const q = localQuery.value.trim();
  if (q) emit("search", q);
}

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
      <t-select
        :value="scope"
        :options="scopeOptions"
        size="small"
        style="width: 100px; flex-shrink: 0;"
        @change="(v: string) => emit('update:scope', v as 'channel' | 'server')"
      />
      <t-input
        :value="localQuery"
        :placeholder="t('search_current_channel')"
        @input="handleInput"
        @enter="handleSearch"
      />
      <button
        type="button"
        class="cp-searchPanel__close"
        :aria-label="t('close')"
        @click="emit('close')"
      >
        &times;
      </button>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="cp-searchPanel__state cp-searchPanel__state--loading">
      <t-icon name="loading" />
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
.cp-searchPanel {
  border-bottom: 1px solid var(--cp-border-color, #e0e0e0);
  background: var(--cp-bg-secondary, #fafafa);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow: hidden;
}

.cp-searchPanel__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cp-searchPanel__close {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.cp-searchPanel__state {
  font-size: 13px;
  color: var(--cp-text-secondary, #888);
  padding: 4px 0;
}

.cp-searchPanel__state--loading {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cp-searchPanel__state--error {
  color: var(--cp-danger, #e34);

  .cp-searchPanel__errorText {
    margin-right: 8px;
  }
}

.cp-searchPanel__state--empty {
  color: var(--cp-text-secondary, #888);
}

.cp-searchPanel__retry {
  background: none;
  border: 1px solid var(--cp-primary, #5865f2);
  color: var(--cp-primary, #5865f2);
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: color-mix(in oklab, var(--cp-primary) 10%, transparent);
  }
}

.cp-searchPanel__results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 160px;
}

.cp-searchPanel__result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  outline: none;

  &:focus-visible {
    outline: 2px solid var(--cp-primary, #5865f2);
    outline-offset: -2px;
  }

  &:hover {
    background: color-mix(in oklab, var(--cp-primary) 8%, transparent);
  }
}

.cp-searchPanel__result--active {
  background: color-mix(in oklab, var(--cp-primary) 12%, transparent);
}

.cp-searchPanel__resultSender {
  font-weight: 600;
  color: var(--cp-text-primary, #222);
}

.cp-searchPanel__resultChannel {
  font-size: 11px;
  color: var(--cp-accent, #5865f2);
  font-weight: 500;
  margin-bottom: 1px;
}

.cp-searchPanel__resultPreview {
  color: var(--cp-text-secondary, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  :deep(mark) {
    background: color-mix(in oklab, var(--cp-warning, #ffd000) 40%, transparent);
    color: inherit;
    border-radius: 2px;
    padding: 0 1px;
  }
}
</style>
