<script setup lang="ts">
/**
 * @fileoverview 更新提示弹窗组件。
 */
import { ref } from 'vue';
import { check } from '@tauri-apps/plugin-updater';
import { createLogger } from '@/shared/utils/logger';
import { useI18n } from 'vue-i18n';

const logger = createLogger('updater');
const { t } = useI18n();

const props = defineProps<{
  version: string;
  body?: string;
}>();

const emit = defineEmits<{
  (e: 'install'): void;
  (e: 'dismiss'): void;
}>();

const downloading = ref(false);
const downloadProgress = ref(0);

async function handleInstall(): Promise<void> {
  downloading.value = true;
  try {
    const result = await check();
    if (!result) {
      downloading.value = false;
      return;
    }
    // Track download progress manually from events
    let contentLength = 0;
    let downloadedBytes = 0;
    await result.download((progress) => {
      if (progress.event === 'Started' && progress.data.contentLength) {
        contentLength = progress.data.contentLength;
      } else if (progress.event === 'Progress') {
        downloadedBytes += progress.data.chunkLength;
        if (contentLength > 0) {
          downloadProgress.value = Math.round((downloadedBytes / contentLength) * 100);
        }
      }
    });
    // Install (requires app restart)
    await result.install();
  } catch (e) {
    logger.error('Action: http_update_download_failed', { error: String(e) });
    downloading.value = false;
  }
}
</script>

<template>
  <div class="update-prompt-overlay">
    <div class="update-prompt-card">
      <div class="update-prompt-icon">🔄</div>
      <h3 class="update-prompt-title">{{ t('updater_new_version', { version: props.version }) }}</h3>
      <p v-if="props.body" class="update-prompt-body">{{ props.body }}</p>
      <div class="update-prompt-actions">
        <button
          class="cp-field update-prompt-btn update-prompt-btn--primary"
          :disabled="downloading"
          @click="handleInstall"
        >
          {{ downloading ? (downloadProgress > 0 ? t('updater_downloading', { percent: downloadProgress }) : t('updater_downloading', { percent: 0 })) : t('updater_install') }}
        </button>
        <button class="update-prompt-btn update-prompt-btn--secondary" @click="emit('dismiss')">
          {{ t('updater_later') }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.update-prompt-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.48);
  backdrop-filter: blur(8px);
  z-index: 9999;
}

.update-prompt-card {
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-lg);
  padding: 32px;
  max-width: 420px;
  width: 90vw;
  box-shadow: var(--cp-shadow);
  text-align: center;
}

.update-prompt-icon {
  font-size: 40px;
  margin-bottom: 16px;
}

.update-prompt-title {
  font-family: var(--cp-font-display);
  font-size: 18px;
  color: var(--cp-text);
  margin: 0 0 12px;
}

.update-prompt-body {
  font-size: 13px;
  color: var(--cp-text-muted);
  margin: 0 0 24px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.update-prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-prompt-btn {
  border-radius: 999px;
  padding: 10px 24px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--cp-border);
  transition: background-color var(--cp-fast) var(--cp-ease);

  &--primary {
    background: var(--cp-accent);
    color: #fff;
    border-color: var(--cp-accent);
    &:hover { background: var(--cp-accent-hover); }
    &:disabled { opacity: 0.6; cursor: wait; }
  }

  &--secondary {
    background: transparent;
    color: var(--cp-text-muted);
    &:hover { background: var(--cp-hover-bg); }
  }
}
</style>
