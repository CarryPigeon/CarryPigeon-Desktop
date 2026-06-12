<script setup lang="ts">
/**
 * @fileoverview 全局错误边界组件。
 * 捕获子组件树中未处理的异常，渲染降级 UI。
 */
import { ref, onErrorCaptured } from 'vue';
import { createLogger } from '@/shared/utils/logger';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const logger = createLogger('ErrorBoundary');

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err: unknown, _instance: ComponentPublicInstance | null, _info: string) => {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('Action: plugins_boundary_error_captured', { error: message });
  errorMessage.value = message;
  hasError.value = true;
  return false;
});

function handleRetry(): void {
  hasError.value = false;
  errorMessage.value = '';
}
</script>

<template>
  <slot v-if="!hasError" />

  <div v-else class="error-boundary">
    <div class="error-boundary-card">
      <span class="error-boundary-icon">&#x26A0;&#xFE0F;</span>
      <h3 class="error-boundary-title">{{ t('error_boundary_title') }}</h3>
      <p class="error-boundary-detail">{{ errorMessage || t('error_boundary_unknown') }}</p>
      <button class="error-boundary-btn" @click="handleRetry">
        {{ t('error_boundary_retry') }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--cp-bg);
}

.error-boundary-card {
  text-align: center;
  padding: 40px;
  background: var(--cp-panel);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-lg);
  box-shadow: var(--cp-shadow-soft);
  max-width: 380px;
  width: 80vw;
}

.error-boundary-icon {
  font-size: 40px;
}

.error-boundary-title {
  font-family: var(--cp-font-display);
  font-size: 18px;
  color: var(--cp-text);
  margin: 12px 0 8px;
}

.error-boundary-detail {
  font-size: 12px;
  color: var(--cp-text-muted);
  margin: 0 0 20px;
  word-break: break-all;
  max-height: 80px;
  overflow: auto;
}

.error-boundary-btn {
  border-radius: 999px;
  padding: 8px 28px;
  font-size: 13px;
  cursor: pointer;
  background: var(--cp-accent);
  color: #fff;
  border: none;
  transition: background-color var(--cp-fast) var(--cp-ease);
  &:hover { background: var(--cp-accent-hover); }
}
</style>
