<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest } from "../../script/service/PluginLoader";

const props = defineProps<{
  activePluginName?: string | null;
}>();

const emit = defineEmits<{
  (e: "select", plugin: PluginManifest): void;
  (e: "toggle-plugin-loader-panel"): void;
}>();

const plugins = ref<PluginManifest[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function refresh(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    plugins.value = await invoke<PluginManifest[]>("list_plugins");
  } catch (err) {
    plugins.value = [];
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  refresh();
});

const hasPlugins = computed(() => plugins.value.length > 0);

function pluginInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : "?";
}

function onSelect(plugin: PluginManifest): void {
  emit("select", plugin);
}

function onTogglePluginLoaderPanel(): void {
  emit("toggle-plugin-loader-panel");
}
</script>

<template>
  <div class="plugin-list">
    <div v-if="hasPlugins" class="items">
      <button
        v-for="plugin in plugins"
        :key="plugin.name"
        class="item"
        :class="plugin.name === (props.activePluginName ?? null) ? 'active' : ''"
        type="button"
        :title="`${plugin.name} ${plugin.version ?? ''}`"
        @click="onSelect(plugin)"
      >
        <span class="icon">{{ pluginInitial(plugin.name) }}</span>
      </button>
    </div>

    <button
      class="plugin-manager"
      type="button"
      :title="error ?? ''"
      @click="onTogglePluginLoaderPanel"
    >
      <span v-if="loading">...</span>
      <span v-else>+</span>
    </button>
  </div>
</template>

<style scoped lang="scss">
.plugin-list {
  width: 100%;
  padding: 10px 0 0;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.item {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(31, 41, 55, 1);
  cursor: pointer;
  padding: 0;
  display: grid;
  place-items: center;
  color: #e5e7eb;
}

.item.active {
  border-color: rgba(59, 130, 246, 0.9);
  background: rgba(59, 130, 246, 0.25);
}

.icon {
  font-weight: 700;
  font-size: 18px;
  line-height: 1;
}

.plugin-manager {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  border: 1px dashed rgba(148, 163, 184, 0.35);
  color: rgba(148, 163, 184, 0.9);
  user-select: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
}
</style>
