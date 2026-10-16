<template>
  <div class="cp-screenshot-btn-group">
    <button
      class="cp-screenshot-btn"
      type="button"
      :disabled="loading"
      :title="t('screenshot')"
      :aria-label="t('screenshot')"
      @click="handleClick(true)"
    >
      <!-- 自绘相机图标（取自统一注册表），与表情/附件按钮同风格 -->
      <AppIcon name="camera" :size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { createLogger } from "@/shared/utils/logger";
import { safeListen } from "@/shared/tauri/events";
import { startScreenshot } from "../../data/screenshotCommands";

const { t } = useI18n();
const logger = createLogger("screenshot");
const loading = ref(false);

async function handleClick(hideWindow: boolean) {
  if (loading.value) return;
  loading.value = true;
  try {
    await startScreenshot(hideWindow);
  } catch (err) {
    logger.error("Action: api_screenshot_failed", { error: String(err) });
    loading.value = false;
  }
}

let unlistenCompleted: (() => void) | null = null;
let unlistenCancelled: (() => void) | null = null;
let mounted = true;

onMounted(() => {
  void safeListen("screenshot-completed", () => {
    if (mounted) loading.value = false;
  }).then((u) => { if (mounted) unlistenCompleted = u; });
  void safeListen("screenshot-cancelled", () => {
    if (mounted) loading.value = false;
  }).then((u) => { if (mounted) unlistenCancelled = u; });
});

onBeforeUnmount(() => {
  mounted = false;
  unlistenCompleted?.();
  unlistenCancelled?.();
});
</script>

<style scoped>
.cp-screenshot-btn-group {
  position: relative;
  display: inline-flex;
}

.cp-screenshot-btn-group .cp-screenshot-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}
.cp-screenshot-btn-group .cp-screenshot-btn:hover:enabled {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
}
.cp-screenshot-btn-group .cp-screenshot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cp-screenshot-btn-group .cp-screenshot-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}
</style>
