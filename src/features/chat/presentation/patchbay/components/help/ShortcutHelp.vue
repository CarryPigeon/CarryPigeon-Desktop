<script setup lang="ts">
/**
 * @fileoverview ShortcutHelp.vue
 * @description 快捷键帮助面板：展示所有注册的键盘快捷键及其组合键。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ShortcutBinding } from "@/features/chat/presentation/patchbay/interactions/usePatchbayHotkeys";

const props = defineProps<{
  /** 面板可见性。 */
  visible: boolean;
  /** 快捷键绑定列表。 */
  bindings: ShortcutBinding[];
}>();

const emit = defineEmits<{
  close: [];
}>();

const { t } = useI18n();

/**
 * 按 category 分组的快捷键列表。
 * 顺序：导航 → 操作 → 通用。
 */
const groupedBindings = computed(() => {
  const groups: { category: string; titleKey: string; items: ShortcutBinding[] }[] = [
    { category: "navigation", titleKey: "shortcuts_navigation", items: [] },
    { category: "actions", titleKey: "shortcuts_actions", items: [] },
    { category: "general", titleKey: "shortcuts_general", items: [] },
  ];

  for (const binding of props.bindings) {
    const group = groups.find((g) => g.category === binding.category);
    if (group) {
      group.items.push(binding);
    }
  }

  return groups.filter((g) => g.items.length > 0);
});

/**
 * 将按键名格式化为可读的键帽文本。
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    escape: "Esc",
    arrowup: "↑",
    arrowdown: "↓",
    arrowleft: "←",
    arrowright: "→",
    enter: "Enter",
    tab: "Tab",
    " ": "Space",
    ",": ",",
    "/": "/",
  };
  return keyMap[key.toLowerCase()] ?? key.toUpperCase();
}

/**
 * 平台修饰键符号：macOS 用 ⌘，其他用 Ctrl。
 */
const metaSymbol = computed(() => {
  if (typeof navigator !== "undefined" && /mac|darwin/i.test(navigator.platform)) {
    return "⌘";
  }
  return "Ctrl";
});
</script>

<template>
  <Teleport to="body">
    <Transition name="cp-shortcut-fade">
      <div
        v-if="visible"
        class="cp-shortcut-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="t('keyboard_shortcuts')"
        @click.self="emit('close')"
        @keydown.escape="emit('close')"
      >
        <div class="cp-shortcut-panel">
          <!-- 头部 -->
          <div class="cp-shortcut-panel__header">
            <h2 class="cp-shortcut-panel__title">{{ t("keyboard_shortcuts") }}</h2>
            <button
              class="cp-shortcut-panel__close"
              type="button"
              :aria-label="t('close')"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <!-- 快捷键分组列表 -->
          <div class="cp-shortcut-panel__body">
            <div
              v-for="group in groupedBindings"
              :key="group.category"
              class="cp-shortcut-group"
            >
              <h3 class="cp-shortcut-group__title">{{ t(group.titleKey) }}</h3>
              <div
                v-for="binding in group.items"
                :key="binding.key"
                class="cp-shortcut-row"
              >
                <span class="cp-shortcut-row__label">{{ t(binding.description) }}</span>
                <span class="cp-shortcut-row__keys">
                  <kbd
                    v-if="binding.meta"
                    class="cp-shortcut-key"
                  >{{ metaSymbol }}</kbd>
                  <kbd
                    v-if="binding.alt"
                    class="cp-shortcut-key"
                  >⌥</kbd>
                  <kbd
                    v-if="binding.shift"
                    class="cp-shortcut-key"
                  >⇧</kbd>
                  <kbd class="cp-shortcut-key cp-shortcut-key--main">{{ formatKey(binding.key) }}</kbd>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 遮罩层 */
.cp-shortcut-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--cp-bg, #000) 50%, transparent);
}

/* 面板容器 */
.cp-shortcut-panel {
  width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  overflow-y: auto;
  background: var(--cp-bg-secondary, #1e1e2e);
  border: 1px solid var(--cp-border, #3a3a4a);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

/* 头部 */
.cp-shortcut-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--cp-border, #3a3a4a);
}

.cp-shortcut-panel__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--cp-text-primary, #e0e0e0);
}

.cp-shortcut-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--cp-text-secondary, #999);
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cp-shortcut-panel__close:hover {
  background: var(--cp-hover, rgba(255, 255, 255, 0.08));
  color: var(--cp-text-primary, #e0e0e0);
}

/* 内容 */
.cp-shortcut-panel__body {
  padding: 12px 20px 20px;
}

/* 分组 */
.cp-shortcut-group {
  margin-top: 16px;
}

.cp-shortcut-group:first-child {
  margin-top: 0;
}

.cp-shortcut-group__title {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--cp-text-tertiary, #777);
}

/* 行 */
.cp-shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.cp-shortcut-row:hover {
  background: var(--cp-hover, rgba(255, 255, 255, 0.04));
}

.cp-shortcut-row__label {
  font-size: 14px;
  color: var(--cp-text-primary, #e0e0e0);
}

.cp-shortcut-row__keys {
  display: flex;
  gap: 4px;
  align-items: center;
  flex-shrink: 0;
}

/* 键帽 */
.cp-shortcut-key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--cp-border, #3a3a4a);
  border-radius: 4px;
  background: var(--cp-bg-tertiary, #2a2a3a);
  color: var(--cp-text-secondary, #bbb);
  font-size: 11px;
  font-family: inherit;
  line-height: 1;
}

.cp-shortcut-key--main {
  color: var(--cp-text-primary, #e0e0e0);
  font-weight: 600;
}

/* 过渡动画 */
.cp-shortcut-fade-enter-active,
.cp-shortcut-fade-leave-active {
  transition: opacity 0.2s ease;
}

.cp-shortcut-fade-enter-from,
.cp-shortcut-fade-leave-to {
  opacity: 0;
}
</style>
