<script setup lang="ts">
/**
 * @fileoverview 更新提示弹窗组件。
 * @description 检测到新版本时提示用户，点击跳转 GitHub Releases 手动下载。
 */
import { useI18n } from 'vue-i18n';
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { invokeTauri } from '@/shared/tauri/invokeClient';
import AppIcon from "@/shared/ui/AppIcon.vue";
const { t } = useI18n();

const props = defineProps<{
  version: string;
  releaseUrl: string;
}>();

const emit = defineEmits<{
  (e: 'dismiss'): void;
}>();

function handleOpenRelease(): void {
  void invokeTauri(TAURI_COMMANDS.openUrl, { url: props.releaseUrl }).catch(() => {
    window.open(props.releaseUrl, '_blank');
  });
  emit('dismiss');
}
</script>

<template>
  <div class="update-prompt-overlay">
    <div class="update-prompt-card">
      <div class="update-prompt-icon"><AppIcon name="refresh" :size="40" /></div>
      <h3 class="update-prompt-title">{{ t('updater_new_version', { version: props.version }) }}</h3>
      <p class="update-prompt-body">{{ t('updater_manual_hint') }}</p>
      <div class="update-prompt-actions">
        <button
          class="update-prompt-btn update-prompt-btn--primary"
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
/* 样式：UpdatePrompt｜规格：模糊遮罩 + 18px 玻璃弹窗 + 胶囊按钮 */
.update-prompt-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in oklab, var(--cp-bg) 48%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 9999;
}

.update-prompt-card {
  @include cp-glass-panel;

  padding: 32px;
  max-width: 420px;
  width: 90vw;
  text-align: center;
}

.update-prompt-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border: 1px solid var(--cp-border-light);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
  color: var(--cp-accent);
}

.update-prompt-title {
  margin: 0 0 12px;
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 18px;
  color: var(--cp-text);
}

.update-prompt-body {
  margin: 0 0 24px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.update-prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.update-prompt-btn {
  @include cp-pill-button;

  width: 100%;
  min-height: 36px;
}

.update-prompt-btn--primary {
  @include cp-pill-button(primary);
}
</style>
