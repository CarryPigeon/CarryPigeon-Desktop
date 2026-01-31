<script setup lang="ts">
/**
 * @fileoverview PluginDetailPage.vue (Patchbay).
 */

import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { invokeTauri, TAURI_COMMANDS } from "@/shared/tauri";

type PluginManifest = {
  name: string;
  version: string;
  description?: string | null;
  author?: string | null;
  license?: string | null;
  url: string;
  frontend_sha256: string;
  backend_sha256: string;
  icon?: string | null;
};

const route = useRoute();
const router = useRouter();

const pluginId = computed(() => String(route.params.pluginId ?? "").trim());
const loading = ref(false);
const error = ref<string | null>(null);
const plugin = ref<PluginManifest | null>(null);

async function load() {
  if (!pluginId.value) return;
  loading.value = true;
  error.value = null;
  try {
    const list = await invokeTauri<PluginManifest[]>(TAURI_COMMANDS.listPlugins);
    plugin.value = (Array.isArray(list) ? list : []).find((p) => p.name === pluginId.value) ?? null;
    if (!plugin.value) error.value = "Plugin not found";
  } catch (e) {
    plugin.value = null;
    error.value = String(e);
  } finally {
    loading.value = false;
  }
}

function back() {
  void router.back();
}

onMounted(() => {
  void load();
});
</script>

<template>
  <!-- 页面：PluginDetailPage｜职责：插件详情（抽屉/页） -->
  <!-- 区块：<div> .detail -->
  <div class="detail">
    <header class="top">
      <button class="btn" type="button" @click="back">{{ $t("back") }}</button>
      <div class="crumb mono">/plugins/detail/{{ pluginId }}</div>
    </header>

    <div class="card">
      <div v-if="loading" class="state">{{ $t("loading") }}</div>
      <div v-else-if="error" class="state error">{{ error }}</div>
      <template v-else-if="plugin">
        <div class="head">
          <div class="name">{{ plugin.name }}</div>
          <div class="ver mono">{{ plugin.version }}</div>
        </div>
        <div class="desc">{{ plugin.description || "—" }}</div>
        <div class="kv">
          <div class="k mono">url</div>
          <div class="v mono">{{ plugin.url || "—" }}</div>
        </div>
        <div class="kv">
          <div class="k mono">frontend_sha256</div>
          <div class="v mono">{{ plugin.frontend_sha256 || "—" }}</div>
        </div>
        <div class="kv">
          <div class="k mono">backend_sha256</div>
          <div class="v mono">{{ plugin.backend_sha256 || "—" }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* Patchbay: detail drawer as full page */
.detail {
  width: 100vw;
  height: 100vh;
  padding: 14px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.btn {
  border: 1px solid rgba(56, 189, 248, 0.24);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 14px;
  padding: 10px 12px;
  cursor: pointer;
  font-size: 13px;
}

.crumb {
  opacity: 0.75;
}

.card {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--cp-shadow);
  overflow: auto;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.name {
  font-family: var(--cp-font-display);
  font-size: 18px;
  color: var(--cp-text);
}

.ver {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.desc {
  margin-top: 10px;
  color: var(--cp-text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.kv {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed rgba(148, 163, 184, 0.18);
  display: grid;
  grid-template-columns: 160px minmax(0, 1fr);
  gap: 10px;
}

.k {
  color: var(--cp-text-muted);
}

.v {
  color: var(--cp-text);
  word-break: break-word;
}

.mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
}

.state {
  padding: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.30);
  border-radius: 16px;
  color: var(--cp-text-muted);
}

.state.error {
  border-color: rgba(239, 68, 68, 0.34);
  color: rgba(254, 202, 202, 0.92);
}
</style>
