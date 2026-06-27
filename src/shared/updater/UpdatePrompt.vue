<script setup lang="ts">
/**
 * @fileoverview 更新提示弹窗组件。
 * @description 检测到新版本时提示用户，点击跳转 GitHub Releases 手动下载。
 */
import { useI18n } from 'vue-i18n';
import { invokeTauri } from '@/shared/tauri/invokeClient';
const { t } = useI18n();

const props = defineProps<{
  version: string;
  releaseUrl: string;
}>();

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

function handleOpenRelease(): void {
  void invokeTauri('plugin:opener|open_url', { url: props.releaseUrl }).catch(() => {
    window.open(props.releaseUrl, '_blank');
  });
  emit('dismiss');
}
</script>

<template>
  <div class="update-prompt-overlay">
    <div class="update-prompt-card">
      <div class="update-prompt-icon"><t-icon name="refresh" size="40" /></div>
      <h3 class="update-prompt-title">{{ t('updater_new_version', { version: props.version }) }}</h3>
      <p class="update-prompt-body">{{ t('updater_manual_hint') }}</p>
      <div class="update-prompt-actions">
        <button
          class="cp-field update-prompt-btn update-prompt-btn--primary"
          type="button"
          @click="handleOpenRelease"
        >
          {{ t('updater_download_page') }}
        </button>
        <button
          class="update-prompt-btn update-prompt-btn--secondary"
          type="button"
          @click="emit('dismiss')"
        >
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
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-accent);
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
  }

  &--secondary {
    background: transparent;
    color: var(--cp-text-muted);
    &:hover { background: var(--cp-hover-bg); }
  }
}
</style>
