<template>
  <t-popup
    trigger="click"
    placement="top"
    :visible="popupVisible"
    @visible-change="onPopupVisibleChange"
  >
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
    <template #content>
      <div class="cp-screenshot-menu">
        <button class="cp-screenshot-menu__item" @click="handleStandardClick">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span>{{ t('screenshot_standard') }}</span>
        </button>
        <button class="cp-screenshot-menu__item" @click="handleNoHideClick">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
          <span>{{ t('screenshot_no_hide') }}</span>
        </button>
      </div>
    </template>
  </t-popup>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { createLogger } from "@/shared/utils/logger";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { startScreenshot } from "../../data/screenshotCommands";

const { t } = useI18n();
const logger = createLogger("screenshot");
const loading = ref(false);
const popupVisible = ref(false);

function onPopupVisibleChange(visible: boolean): void {
  popupVisible.value = visible;
}

let unlistenCompleted: UnlistenFn | null = null;
let unlistenCancelled: UnlistenFn | null = null;

onMounted(() => {
  listen("screenshot-completed", () => {
    loading.value = false;
  }).then((u) => { unlistenCompleted = u; });
  listen("screenshot-cancelled", () => {
    loading.value = false;
  }).then((u) => { unlistenCancelled = u; });
});

onBeforeUnmount(() => {
  unlistenCompleted?.();
  unlistenCancelled?.();
});

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

async function handleStandardClick() {
  popupVisible.value = false;
  if (loading.value) return;
  loading.value = true;
  try {
    await startScreenshot();
  } catch (err) {
    logger.error("Action: api_screenshot_failed", { error: String(err) });
    loading.value = false;
  }
}

async function handleNoHideClick() {
  popupVisible.value = false;
  if (loading.value) return;
  loading.value = true;
  try {
    await startScreenshot(false);
  } catch (err) {
    logger.error("Action: api_screenshot_failed", { error: String(err) });
    loading.value = false;
  }
}
</script>

<style scoped>
.cp-screenshot-menu {
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  box-shadow: var(--cp-shadow);
  padding: 6px;
  backdrop-filter: blur(10px);
}

.cp-screenshot-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.cp-screenshot-menu__item:hover {
  background: var(--cp-hover-bg);
}

.cp-screenshot-menu__item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

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
