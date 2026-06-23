<template>
  <button
    class="cp-screenshot-btn"
    type="button"
    :disabled="loading"
    :title="t('screenshot')"
    @click="handleClick"
  >
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { createLogger } from "@/shared/utils/logger";
import { startScreenshot } from "../../data/screenshotCommands";

const { t } = useI18n();
const logger = createLogger("screenshot");
const loading = ref(false);

async function handleClick() {
  if (loading.value) return;
  loading.value = true;
  try {
    await startScreenshot();
  } catch (err) {
    logger.error("Action: api_screenshot_failed", { error: String(err) });
    loading.value = false;
  }
}
</script>

<style scoped>
.cp-screenshot-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--cp-border);
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}
.cp-screenshot-btn:hover:enabled {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
  border-color: var(--cp-accent);
}
.cp-screenshot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
