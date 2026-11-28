<script setup lang="ts">
import { nextTick, ref } from "vue";
import type { ThemePreference } from "../domain/themes";

const props = defineProps<{
  readPreference: () => ThemePreference;
  selectPreference: (value: ThemePreference) => void;
}>();
const modes = ["light", "dark", "system"] as const;
const labels = {
  light: "浅色 / Light",
  dark: "深色 / Dark",
  system: "跟随系统 / System",
};
const dialog = ref<HTMLDialogElement | null>(null);
const current = ref<ThemePreference>("light");

async function open(): Promise<void> {
  current.value = props.readPreference();
  await nextTick();
  if (dialog.value && !dialog.value.open) dialog.value.showModal();
}

function select(mode: ThemePreference): void {
  props.selectPreference(mode);
  dialog.value?.close();
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialog" class="cp-theme-picker" aria-label="外观主题 / Appearance">
    <h2>外观主题 / Appearance</h2>
    <div class="cp-theme-picker__options">
      <button v-for="mode in modes" :key="mode" type="button" :aria-pressed="mode === current" @click="select(mode)">
        {{ labels[mode] }}<span v-if="mode === current" aria-hidden="true"> ✓</span>
      </button>
    </div>
    <form method="dialog"><button type="submit">取消 / Cancel</button></form>
  </dialog>
</template>

<style scoped>
.cp-theme-picker {
  max-width: calc(100vw - 32px);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-surface);
  color: var(--cp-text);
}
.cp-theme-picker__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.cp-theme-picker button {
  padding: 6px 10px;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-surface);
  color: inherit;
  cursor: pointer;
}
.cp-theme-picker button[aria-pressed="true"] {
  background: var(--cp-hover-bg);
  font-weight: 600;
}
</style>
