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
  logger.error('Action: plugins_boundary_error_captured', {
    error: message,
    typeof: typeof err,
    isError: err instanceof Error,
    name: err instanceof Error ? err.name : undefined,
    rawMessage: err instanceof Error ? err.message : undefined,
    stack: err instanceof Error ? err.stack : undefined,
    info: _info,
    component: (_instance as { type?: { name?: string } } | null)?.type?.name,
  });
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
  @include cp-glass-panel;

  text-align: center;
  padding: 40px;
  max-width: 380px;
  width: 80vw;
}

.error-boundary-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--cp-danger-border);
  border-radius: 999px;
  background: var(--cp-danger-bg);
  font-size: 26px;
}

.error-boundary-title {
  margin: 12px 0 8px;
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 18px;
  color: var(--cp-text);
}

.error-boundary-detail {
  margin: 0 0 20px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
  word-break: break-all;
  max-height: 80px;
  overflow: auto;
}

.error-boundary-btn {
  @include cp-pill-button(primary);

  min-height: 36px;
  padding: 0 28px;
}
</style>
