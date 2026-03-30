<script setup lang="ts">
/**
 * @fileoverview QuickSwitcher.vue
 * @description chat｜组件：QuickSwitcher。
 */

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { QuickSwitcherItem } from "@/features/chat/presentation/patchbay/state/quickSwitcherTypes";

const props = defineProps<{
  open: boolean;
  query: string;
  items: readonly QuickSwitcherItem[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  (e: "update:open", v: boolean): void;
  (e: "update:query", v: string): void;
  (e: "update:activeIndex", v: number): void;
  (e: "select", item: QuickSwitcherItem): void;
}>();

const { t } = useI18n();
const inputEl = ref<HTMLInputElement | null>(null);

function itemDomId(index: number): string {
  return `cp-quick-switcher-option-${index}`;
}

function activeItemDomId(): string | undefined {
  if (props.items.length <= 0) return undefined;
  const idx = Math.max(0, Math.min(props.items.length - 1, Math.trunc(props.activeIndex)));
  return itemDomId(idx);
}

/**
 * 在面板渲染完成后聚焦输入框。
 *
 * 说明：
 * 等待 next tick，确保输入框已进入 DOM。
 *
 * @returns 无返回值。
 */
async function focusInput(): Promise<void> {
  await nextTick();
  inputEl.value?.focus();
}

/**
 * 关闭快捷切换弹窗。
 *
 * @returns 无返回值。
 */
function close(): void {
  emit("update:open", false);
}

/**
 * 确保 `activeIndex` 始终处于当前 `items` 的有效范围内。
 *
 * 当过滤导致列表长度变化时，避免出现越界访问。
 *
 * @returns 无返回值。
 */
function clampIndex(): void {
  const n = props.items.length;
  if (n <= 0) {
    emit("update:activeIndex", 0);
    return;
  }
  const idx = Math.max(0, Math.min(n - 1, Math.trunc(props.activeIndex)));
  if (idx !== props.activeIndex) emit("update:activeIndex", idx);
}

/**
 * 处理输入框内的键盘导航逻辑。
 *
 * 支持按键：
 * - Escape：关闭
 * - ArrowUp/ArrowDown：切换选中项（循环）
 * - Enter：选择当前项
 *
 * @param e - 键盘事件。
 * @returns 无返回值。
 */
function handleKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    const n = props.items.length;
    if (n <= 0) return;
    emit("update:activeIndex", (props.activeIndex + 1) % n);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    const n = props.items.length;
    if (n <= 0) return;
    emit("update:activeIndex", (props.activeIndex - 1 + n) % n);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const item = props.items[props.activeIndex];
    if (!item) return;
    emit("select", item);
  }
}

/**
 * 全局 keydown：确保即使焦点离开输入框，也能通过 Escape 关闭。
 *
 * @param e - 键盘事件。
 * @returns 无返回值。
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) void focusInput();
  },
);
watch(() => props.items.length, clampIndex);

/**
 * 处理输入框变更并向外同步 query。
 *
 * @param e - `<input>` 的 input 事件。
 * @returns 无返回值。
 */
function handleInput(e: Event): void {
  const el = e.target as HTMLInputElement | null;
  emit("update:query", el?.value ?? "");
}

onMounted(() => {
  window.addEventListener("keydown", onGlobalKeydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onGlobalKeydown);
});
</script>

<template>
  <!-- 组件：QuickSwitcher｜职责：快捷切换（Ctrl/Cmd+K） -->
  <!-- 区块：<div> .cp-qs -->
  <div v-if="props.open" class="cp-qs" role="dialog" aria-modal="true" @click.self="close">
    <div class="cp-qs__panel">
      <div class="cp-qs__title">
        <div class="cp-qs__titleEn">QUICK SWITCHER</div>
        <div class="cp-qs__titleZh">{{ t("search_bar") }}</div>
      </div>

      <input
        ref="inputEl"
        class="cp-qs__input"
        :value="props.query"
        :placeholder="t('search_placeholder')"
        @input="handleInput"
        @keydown="handleKeydown"
      />

      <div
        class="cp-qs__list"
        role="listbox"
        aria-label="results"
        :aria-activedescendant="activeItemDomId()"
      >
        <button
          v-for="(it, idx) in props.items"
          :id="itemDomId(idx)"
          :key="`${it.kind}:${it.id}`"
          class="cp-qs__item"
          type="button"
          :data-active="idx === props.activeIndex"
          role="option"
          :aria-selected="idx === props.activeIndex"
          @mouseenter="emit('update:activeIndex', idx)"
          @click="emit('select', it)"
        >
          <span class="cp-qs__kind">{{ it.kind }}</span>
          <span class="cp-qs__main">
            <span class="cp-qs__itTitle">{{ it.title }}</span>
            <span class="cp-qs__itSub">{{ it.subtitle }}</span>
          </span>
        </button>

        <div v-if="props.items.length === 0" class="cp-qs__empty">{{ t("no_results") }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；全屏遮罩 + 居中面板，列表区可滚动。 */
.cp-qs {
  position: fixed;
  inset: 0;
  background: var(--td-mask-active);
  display: grid;
  place-items: start center;
  padding: 8vh 14px 14px 14px;
  z-index: 50;
}

.cp-qs__panel {
  width: min(720px, 92vw);
  border: 1px solid var(--cp-highlight-border);
  background: var(--cp-panel);
  border-radius: 22px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
}

.cp-qs__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-qs__titleEn {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

.cp-qs__titleZh {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-qs__input {
  margin-top: 12px;
  width: 100%;
  border: 1px solid var(--cp-border);
  background: var(--cp-field-bg);
  color: var(--cp-text);
  border-radius: 16px;
  padding: 12px 12px;
  outline: none;
  font-size: 13px;
  box-shadow: var(--cp-inset);
}

.cp-qs__input:focus {
  box-shadow: var(--cp-inset), var(--cp-ring);
  border-color: var(--cp-highlight-border);
}

.cp-qs__list {
  margin-top: 12px;
  border-top: 1px solid var(--cp-border-light);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: min(54vh, 520px);
  overflow: auto;
}

.cp-qs__item {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 16px;
  padding: 10px;
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 10px;
  align-items: center;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-qs__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

.cp-qs__item[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

.cp-qs__kind {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.cp-qs__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cp-qs__itTitle {
  font-size: 13px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-qs__itSub {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-qs__empty {
  padding: 14px 4px;
  color: var(--cp-text-muted);
  font-size: 12px;
}
</style>
