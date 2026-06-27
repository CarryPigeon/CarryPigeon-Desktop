<script setup lang="ts">
/**
 * @fileoverview 启动过渡层：控制从初始化到就绪的 UI 过渡。
 * 三态：
 * - initializing: Logo + 进度文案
 * - ready: 渲染默认 slot（router-view）
 * - failed: 错误信息 + 重试按钮
 */
import { ref, onMounted } from 'vue';
import { startupPromise, type StartupPhase } from '@/app/bootstrap/startupState';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();

const phase = ref<StartupPhase>('initializing');

onMounted(async () => {
  phase.value = await startupPromise;
});

function handleRetry(): void {
  window.location.reload();
}
</script>

<template>
  <!-- 就绪：渲染子组件 -->
  <template v-if="phase === 'ready'">
    <slot />
  </template>

  <!-- 初始化中 -->
  <div v-else-if="phase === 'initializing'" class="startup-shell">
    <p class="startup-text">CarryPigeon</p>
    <div class="startup-spinner" />
  </div>

  <!-- 启动失败 -->
  <div v-else class="startup-shell startup-shell--failed">
    <div class="startup-logo"><t-icon name="warn-circle" size="40" /></div>
    <p class="startup-text">{{ t('startup_failed') }}</p>
    <p class="startup-hint">{{ t('startup_failed_hint') }}</p>
    <button class="cp-field startup-retry-btn" @click="handleRetry">
      {{ t('startup_retry') }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.startup-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background:
    radial-gradient(900px 600px at 50% 20%, rgba(56, 189, 248, 0.08), transparent 60%),
    linear-gradient(180deg, var(--cp-bg), var(--cp-bg-2));
  gap: 16px;
}

.startup-text {
  font-family: var(--cp-font-display);
  font-size: 22px;
  color: var(--cp-text);
  margin: 0;
  letter-spacing: 0.04em;
}

.startup-hint {
  font-size: 13px;
  color: var(--cp-text-muted);
  margin: 0;
}

.startup-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-warn, var(--cp-danger));
}

.startup-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--cp-border);
  border-top-color: var(--cp-accent);
  border-radius: 50%;
  animation: startup-spin 0.8s linear infinite;
  margin-top: 16px;
}

@keyframes startup-spin {
  to { transform: rotate(360deg); }
}

.startup-retry-btn {
  width: auto;
  padding: 0 32px;
  margin-top: 12px;
  cursor: pointer;
  border-radius: 999px;
  background: var(--cp-accent);
  color: #fff;
  border: none;
  &:hover { background: var(--cp-accent-hover); }
}
</style>
