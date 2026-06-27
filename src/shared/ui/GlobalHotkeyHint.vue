<script setup lang="ts">
/**
 * @fileoverview GlobalHotkeyHint.vue
 * @description 全局快捷键提示条（右下角浮层），所有页面统一展示。
 */
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <!-- 组件：GlobalHotkeyHint｜职责：全局快捷键提示（右下角浮层） -->
  <!-- 区块：<footer> .cp-kbdHint -->
  <footer class="cp-kbdHint" aria-hidden="true">
    <span><kbd>Ctrl/Cmd</kbd>+<kbd>P</kbd> · {{ t("plugins") }}</span>
    <span class="cp-kbdHint__sep">·</span>
    <span><kbd>Ctrl/Cmd</kbd>+<kbd>,</kbd> · {{ t("settings_title") }}</span>
  </footer>
</template>

<style scoped lang="scss">
/* 样式：GlobalHotkeyHint｜布局：右下角浮层半透明 */
.cp-kbdHint {
  position: fixed;
  right: 12px;
  bottom: 8px;
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--cp-text-muted);
  opacity: 0.6;
  user-select: none;
}

.cp-kbdHint kbd {
  font-family: var(--cp-font-mono);
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
}

.cp-kbdHint__sep {
  opacity: 0.5;
}
</style>
