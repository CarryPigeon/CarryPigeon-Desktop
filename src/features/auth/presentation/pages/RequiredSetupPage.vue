<script setup lang="ts">
/**
 * @fileoverview RequiredSetupPage.vue (Patchbay).
 */

import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const missingPlugins = computed(() => {
  const raw = String(route.query.missing ?? "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
});

function openPluginCenterRequired() {
  void router.push({
    path: "/plugins",
    query: { filter: "required", focus_plugin_id: missingPlugins.value[0] ?? "" },
  });
}

function recheck() {
  // Placeholder until required gate is wired to server catalog + local install state.
  window.location.reload();
}

function switchServer() {
  void router.replace("/");
}
</script>

<template>
  <!-- 页面：RequiredSetupPage｜职责：必需插件门禁说明 + 缺失清单 + 跳转插件中心 -->
  <!-- 区块：<div> .required-setup -->
  <div class="required-setup">
    <!-- 区块：<div> .card -->
    <div class="card">
      <!-- 区块：<header> .header -->
      <header class="header">
        <div class="latch">
          <span class="led" aria-hidden="true"></span>
          <span class="latch-title">{{ $t("power_latch_open") }}</span>
        </div>
        <div class="title">{{ $t("required_setup_title") }}</div>
        <div class="desc">{{ $t("required_setup_desc") }}</div>
      </header>

      <!-- 区块：<section> .checklist -->
      <section class="checklist">
        <div class="checklist-title">Missing</div>
        <div v-if="missingPlugins.length" class="list">
          <div v-for="id in missingPlugins" :key="id" class="item">
            <div class="item-left">
              <span class="dot" aria-hidden="true"></span>
              <span class="mono">{{ id }}</span>
            </div>
            <button class="btn ghost" type="button" @click="openPluginCenterRequired">
              {{ $t("open_plugin_center_required") }}
            </button>
          </div>
        </div>
        <div v-else class="empty">No missing list provided.</div>
      </section>

      <!-- 区块：<footer> .actions -->
      <footer class="actions">
        <button class="btn primary" type="button" @click="openPluginCenterRequired">
          {{ $t("open_plugin_center_required") }}
        </button>
        <button class="btn" type="button" @click="recheck">{{ $t("recheck_required") }}</button>
        <button class="btn" type="button" @click="switchServer">{{ $t("switch_server") }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Patchbay: required gate card */
.required-setup {
  width: 100vw;
  height: 100vh;
  padding: 18px;
  box-sizing: border-box;
  display: grid;
  place-items: center;
}

.card {
  width: min(760px, 92vw);
  border-radius: 18px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  box-shadow: var(--cp-shadow);
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header {
  border: 1px dashed rgba(148, 163, 184, 0.34);
  border-radius: 16px;
  background: var(--cp-panel-muted);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.latch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.led {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}

.latch-title {
  font-family: var(--cp-font-display);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.72);
}

.title {
  font-family: var(--cp-font-display);
  font-size: 18px;
  letter-spacing: -0.01em;
  color: var(--cp-text);
}

.desc {
  font-size: 13px;
  color: var(--cp-text-muted);
  line-height: 1.5;
}

.checklist {
  border: 1px solid var(--cp-border-light);
  border-radius: 16px;
  background: var(--cp-panel-muted);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checklist-title {
  font-family: var(--cp-font-display);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(226, 232, 240, 0.62);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: var(--cp-surface);
}

.item-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.9);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.14);
}

.mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: rgba(226, 232, 240, 0.78);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty {
  padding: 10px 0;
  color: var(--cp-text-muted);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
  transition: transform var(--cp-fast) var(--cp-ease), border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(56, 189, 248, 0.30);
  }
}

.btn.primary {
  border-color: rgba(56, 189, 248, 0.30);
  background: linear-gradient(180deg, var(--cp-accent-2-soft), transparent 78%), var(--cp-panel-muted);
}

.btn.ghost {
  border-style: dashed;
}
</style>
