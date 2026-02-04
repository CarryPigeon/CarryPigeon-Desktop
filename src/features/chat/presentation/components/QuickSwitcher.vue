<script setup lang="ts">
/**
 * @fileoverview QuickSwitcher.vue
 * @description Ctrl/Cmd+K quick switcher overlay (servers/channels/modules).
 */

import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

export type QuickSwitcherItem = {
  kind: "server" | "channel" | "module" | "route";
  id: string;
  title: string;
  subtitle: string;
};

const props = defineProps<{
  open: boolean;
  query: string;
  items: QuickSwitcherItem[];
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

/**
 * Focus the input after the panel is rendered.
 *
 * We wait for the next tick so the element exists in the DOM.
 *
 * @returns Promise<void>
 */
async function focusInput(): Promise<void> {
  await nextTick();
  inputEl.value?.focus();
}

/**
 * Close the quick switcher dialog.
 *
 * @returns void
 */
function close(): void {
  emit("update:open", false);
}

/**
 * Ensure `activeIndex` stays within the current `items` bounds.
 *
 * When filtering changes the list size, this prevents out-of-range access.
 *
 * @returns void
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
 * Handle keyboard navigation within the switcher input.
 *
 * Supported keys:
 * - Escape: close
 * - ArrowUp/ArrowDown: change selection (wrap-around)
 * - Enter: select current item
 *
 * @param e - Keyboard event.
 * @returns void
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
 * Global keydown handler to ensure Escape closes even if focus leaves the input.
 *
 * @param e - Keyboard event.
 * @returns void
 */
function onGlobalKeydown(e: KeyboardEvent): void {
  if (!props.open) return;
  if (e.key === "Escape") {
    e.preventDefault();
    close();
  }
}

/**
 * React to open-state changes.
 *
 * When opening, focus the input for instant typing.
 *
 * @param v - Whether the dialog is open.
 * @returns void
 */
function handleOpenChange(v: boolean): void {
  if (v) void focusInput();
}

/**
 * Watch-source: open state.
 *
 * @returns Whether the dialog is open.
 */
function watchOpen(): boolean {
  return props.open;
}

watch(watchOpen, handleOpenChange);

/**
 * React to list-size changes by clamping the active index.
 *
 * @returns void
 */
function handleItemsLengthChange(): void {
  clampIndex();
}

/**
 * Watch-source: items length (react to filtering changes).
 *
 * @returns Current item count.
 */
function watchItemsLength(): number {
  return props.items.length;
}

watch(watchItemsLength, handleItemsLengthChange);

/**
 * Emit query updates from the input element.
 *
 * @param e - Input event from `<input>`.
 * @returns void
 */
function handleInput(e: Event): void {
  const el = e.target as HTMLInputElement | null;
  emit("update:query", el?.value ?? "");
}

/**
 * Component mount hook: attach Escape close handler.
 *
 * @returns void
 */
function handleMounted(): void {
  window.addEventListener("keydown", onGlobalKeydown);
}

onMounted(handleMounted);

/**
 * Component unmount hook: remove global handler.
 *
 * @returns void
 */
function handleBeforeUnmount(): void {
  window.removeEventListener("keydown", onGlobalKeydown);
}

onBeforeUnmount(handleBeforeUnmount);
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

      <div class="cp-qs__list" role="listbox" aria-label="results">
        <button
          v-for="(it, idx) in props.items"
          :key="`${it.kind}:${it.id}`"
          class="cp-qs__item"
          type="button"
          :data-active="idx === props.activeIndex"
          @mousemove="emit('update:activeIndex', idx)"
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
/* QuickSwitcher styles */
/* Selector: `.cp-qs` — full-screen overlay (mask + centering). */
.cp-qs {
  position: fixed;
  inset: 0;
  background: var(--td-mask-active);
  display: grid;
  place-items: start center;
  padding: 8vh 14px 14px 14px;
  z-index: 50;
}

/* Selector: `.cp-qs__panel` — dialog panel container. */
.cp-qs__panel {
  width: min(720px, 92vw);
  border: 1px solid var(--cp-highlight-border);
  background: var(--cp-panel);
  border-radius: 22px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
}

/* Selector: `.cp-qs__title` — title stack wrapper. */
.cp-qs__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Selector: `.cp-qs__titleEn` — English title (display type, uppercase). */
.cp-qs__titleEn {
  font-family: var(--cp-font-display);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

/* Selector: `.cp-qs__titleZh` — subtitle line. */
.cp-qs__titleZh {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Selector: `.cp-qs__input` — query input field. */
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

/* Selector: `.cp-qs__input:focus` — focus ring (uses app ring token). */
.cp-qs__input:focus {
  box-shadow: var(--cp-inset), var(--cp-ring);
  border-color: var(--cp-highlight-border);
}

/* Selector: `.cp-qs__list` — scrollable results list. */
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

/* Selector: `.cp-qs__item` — result row button. */
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

/* Selector: `.cp-qs__item:hover` — hover lift + highlight border. */
.cp-qs__item:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Selector: `.cp-qs__item[data-active="true"]` — keyboard-selected row. */
.cp-qs__item[data-active="true"] {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

/* Selector: `.cp-qs__kind` — kind column (mono). */
.cp-qs__kind {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Selector: `.cp-qs__main` — title/subtitle stack. */
.cp-qs__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

/* Selector: `.cp-qs__itTitle` — primary item title (ellipsis). */
.cp-qs__itTitle {
  font-size: 13px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Selector: `.cp-qs__itSub` — secondary subtitle (mono + ellipsis). */
.cp-qs__itSub {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Selector: `.cp-qs__empty` — empty-state message. */
.cp-qs__empty {
  padding: 14px 4px;
  color: var(--cp-text-muted);
  font-size: 12px;
}
</style>
