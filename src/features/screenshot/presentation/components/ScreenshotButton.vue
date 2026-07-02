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
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    </button>
    <button
      class="cp-screenshot-btn cp-screenshot-btn__dropdown"
      type="button"
      :disabled="loading"
      :aria-label="t('screenshot_options')"
      @click="toggleDropdown"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
    <div v-if="dropdownOpen" class="cp-screenshot-dropdown">
      <button class="cp-screenshot-dropdown__item" @click="handleClick(true)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        <span>{{ t('screenshot_hide') }}</span>
      </button>
      <button class="cp-screenshot-dropdown__item" @click="handleClick(false)">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
        <span>{{ t('screenshot_show') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { createLogger } from "@/shared/utils/logger";
import { safeListen } from "@/shared/tauri/events";
import { startScreenshot } from "../../data/screenshotCommands";

const { t } = useI18n();
const logger = createLogger("screenshot");
const loading = ref(false);
const dropdownOpen = ref(false);

let outsideClickListener: ((e: MouseEvent) => void) | null = null;

function toggleDropdown() {
  if (loading.value) return;
  dropdownOpen.value = !dropdownOpen.value;
}

async function handleClick(hideWindow: boolean) {
  if (loading.value) return;
  dropdownOpen.value = false;
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

  const listener = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest?.(".cp-screenshot-btn-group")) {
      dropdownOpen.value = false;
    }
  };
  document.addEventListener("click", listener);
  outsideClickListener = listener;
});

onBeforeUnmount(() => {
  mounted = false;
  unlistenCompleted?.();
  unlistenCancelled?.();
  if (outsideClickListener) {
    document.removeEventListener("click", outsideClickListener);
  }
});
</script>

<style scoped>
.cp-screenshot-btn-group {
  position: relative;
  display: inline-flex;
}

.cp-screenshot-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: 14px;
  box-shadow: var(--cp-shadow);
  padding: 6px;
  z-index: 1000;
  min-width: 180px;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cp-screenshot-btn-group .cp-screenshot-dropdown__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100% !important;
  height: auto !important;
  padding: 8px 12px !important;
  border: none !important;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
  border-radius: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease;
}

.cp-screenshot-btn-group .cp-screenshot-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px !important;
  height: 32px !important;
  border: 1px solid var(--cp-border);
  background: transparent;
  color: var(--cp-text-muted);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease,
    border-color 0.15s ease;
}
.cp-screenshot-btn-group .cp-screenshot-btn:first-child {
  border-radius: 8px 0 0 8px;
}
.cp-screenshot-btn-group .cp-screenshot-btn:hover:enabled {
  background: var(--cp-hover-bg);
  color: var(--cp-text);
  border-color: var(--cp-accent);
}
.cp-screenshot-btn-group .cp-screenshot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-screenshot-btn-group .cp-screenshot-btn__dropdown {
  width: 20px !important;
  padding: 0 4px !important;
  border-left: none;
  border-radius: 0 8px 8px 0;
}

.cp-screenshot-btn-group .cp-screenshot-dropdown__item:hover {
  background: var(--cp-hover-bg);
}

.cp-screenshot-btn-group .cp-screenshot-dropdown__item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>
