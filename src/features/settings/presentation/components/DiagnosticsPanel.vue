<script setup lang="ts">
/**
 * @fileoverview 诊断面板组件。
 * @description
 * 在设置页中展示运行时诊断信息：内存快照、趋势与最近日志。
 * 仅在开启诊断模式或 dev 构建时提供有效数据。
 */

import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import { getMemoryMonitor } from "@/shared/monitoring/memoryMonitor";
import { isPerformanceMonitoringEnabled } from "@/shared/config/performance";

const { t } = useI18n();

const LOG_LIMIT = 200;
const POLL_INTERVAL_MS = 2000;

const monitor = getMemoryMonitor();
const monitoringEnabled = isPerformanceMonitoringEnabled();

const snapshot = ref(monitor.getLatestSnapshot());
const stats = ref(monitor.getStats());
const trend = ref(monitor.getTrendAnalysis());
const logs = ref<string[]>([]);
const loadingLogs = ref(false);

let timer: number | null = null;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function computeStatus(usedPercentage: number): "normal" | "warning" | "critical" {
  if (usedPercentage >= 90) return "critical";
  if (usedPercentage >= 70) return "warning";
  return "normal";
}

const status = computed(() => {
  if (!snapshot.value) return "normal";
  return computeStatus(snapshot.value.usedPercentage);
});

function refreshMemory(): void {
  snapshot.value = monitor.getLatestSnapshot();
  stats.value = monitor.getStats();
  trend.value = monitor.getTrendAnalysis();
}

async function refreshLogs(): Promise<void> {
  if (!monitoringEnabled) return;
  loadingLogs.value = true;
  try {
    logs.value = await invoke<string[]>(TAURI_COMMANDS.readAppLogLines, { limit: LOG_LIMIT });
  } catch (e) {
    logs.value = [`[ERROR] ${String(e)}`];
  } finally {
    loadingLogs.value = false;
  }
}

async function triggerCleanup(): Promise<void> {
  await monitor.triggerCleanup();
  refreshMemory();
}

onMounted(() => {
  refreshMemory();
  void refreshLogs();
  timer = window.setInterval(() => {
    refreshMemory();
  }, POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<template>
  <div class="cp-diagnostics">
    <section class="cp-diagnostics__section">
      <h4 class="cp-diagnostics__title">{{ t("diagnostics_memory_title") }}</h4>
      <div v-if="!snapshot" class="cp-diagnostics__muted">
        {{ t("diagnostics_no_data") }}
      </div>
      <div v-else class="cp-diagnostics__grid">
        <div class="cp-diagnostics__row">
          <span class="cp-diagnostics__label">{{ t("diagnostics_memory_used") }}</span>
          <span>{{ formatBytes(snapshot.usedJSHeapSize) }} / {{ formatBytes(snapshot.jsHeapSizeLimit) }}</span>
        </div>
        <div class="cp-diagnostics__row">
          <span class="cp-diagnostics__label">{{ t("diagnostics_memory_percentage") }}</span>
          <span :class="`cp-diagnostics__value is-${status}`">{{ snapshot.usedPercentage.toFixed(2) }}%</span>
        </div>
        <div class="cp-diagnostics__row">
          <span class="cp-diagnostics__label">{{ t("diagnostics_memory_trend") }}</span>
          <span>{{ trend ? t(`diagnostics_trend_${trend.trend}`) : "-" }}</span>
        </div>
        <div class="cp-diagnostics__row">
          <span class="cp-diagnostics__label">{{ t("diagnostics_memory_status") }}</span>
          <span :class="`cp-diagnostics__value is-${status}`">{{ t(`diagnostics_status_${status}`) }}</span>
        </div>
      </div>
      <button
        type="button"
        class="cp-diagnostics__btn"
        :disabled="!monitoringEnabled"
        @click="triggerCleanup"
      >
        {{ t("diagnostics_trigger_cleanup") }}
      </button>
    </section>

    <section class="cp-diagnostics__section">
      <div class="cp-diagnostics__header">
        <h4 class="cp-diagnostics__title">{{ t("diagnostics_logs_title") }}</h4>
        <button
          type="button"
          class="cp-diagnostics__btn"
          :disabled="!monitoringEnabled || loadingLogs"
          @click="refreshLogs"
        >
          {{ t("diagnostics_refresh_logs") }}
        </button>
      </div>
      <div class="cp-diagnostics__logs">
        <pre v-for="(line, idx) in logs" :key="idx" class="cp-diagnostics__logLine">{{ line }}</pre>
        <div v-if="logs.length === 0" class="cp-diagnostics__muted">{{ t("diagnostics_no_data") }}</div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cp-diagnostics {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cp-diagnostics__section {
  border: 1px solid var(--cp-border);
  border-radius: 8px;
  padding: 12px;
  background: var(--cp-panel-muted);
}

.cp-diagnostics__title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
}

.cp-diagnostics__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.cp-diagnostics__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.cp-diagnostics__label {
  color: var(--cp-text-muted);
}

.cp-diagnostics__value.is-normal {
  color: var(--cp-success);
}
.cp-diagnostics__value.is-warning {
  color: var(--cp-warning);
}
.cp-diagnostics__value.is-critical {
  color: var(--cp-danger);
}

.cp-diagnostics__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.cp-diagnostics__btn {
  padding: 4px 10px;
  border: 1px solid var(--cp-border);
  border-radius: 6px;
  background: var(--cp-surface);
  color: var(--cp-text);
  cursor: pointer;
  font-size: 12px;
}

.cp-diagnostics__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cp-diagnostics__logs {
  max-height: 320px;
  overflow-y: auto;
  background: var(--cp-bg);
  border-radius: 6px;
  padding: 8px;
  font-family: ui-monospace, monospace;
  font-size: 11px;
  line-height: 1.4;
}

.cp-diagnostics__logLine {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.cp-diagnostics__muted {
  color: var(--cp-text-muted);
  font-size: 12px;
}
</style>
