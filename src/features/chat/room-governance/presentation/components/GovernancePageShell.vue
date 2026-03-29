<script setup lang="ts">
/**
 * @fileoverview GovernancePageShell.vue
 * @description chat/room-governance｜presentation component：治理子页面共享页面骨架。
 */

defineProps<{
  channelName: string;
  subtitle: string;
  isLoading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  back: [];
}>();
</script>

<template>
  <main class="cp-governancePage">
    <header class="cp-governancePage__head">
      <button class="cp-governancePage__back" type="button" @click="emit('back')">
        <slot name="back-label">Back</slot>
      </button>
      <div class="cp-governancePage__title">
        <div class="cp-governancePage__name">{{ channelName }}</div>
        <div class="cp-governancePage__sub">{{ subtitle }}</div>
      </div>
      <div v-if="$slots.actions" class="cp-governancePage__actions">
        <slot name="actions" />
      </div>
    </header>

    <div v-if="isLoading" class="cp-governancePage__state">
      <slot name="loading">Loading</slot>
    </div>
    <div v-else-if="errorMessage" class="cp-governancePage__state cp-governancePage__state--error">
      {{ errorMessage }}
    </div>
    <section v-else class="cp-governancePage__body">
      <slot />
    </section>
  </main>
</template>

<style scoped lang="scss">
.cp-governancePage {
  height: 100%;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-governancePage__head {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  box-shadow: var(--cp-shadow-soft);
  padding: 14px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-governancePage__back {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: transform var(--cp-fast) var(--cp-ease), background-color var(--cp-fast) var(--cp-ease);
}

.cp-governancePage__back:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
}

.cp-governancePage__title {
  min-width: 0;
}

.cp-governancePage__name {
  font-family: var(--cp-font-display);
  font-weight: 900;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-governancePage__sub {
  margin-top: 6px;
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-governancePage__actions {
  display: flex;
  justify-content: flex-end;
}

.cp-governancePage__state {
  padding: 20px;
  text-align: center;
  font-size: 14px;
  color: var(--cp-text-muted);
}

.cp-governancePage__state--error {
  color: var(--cp-danger);
}

.cp-governancePage__body {
  flex: 1 1 auto;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-surface);
  border-radius: 18px;
  box-shadow: var(--cp-shadow);
  padding: 14px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
