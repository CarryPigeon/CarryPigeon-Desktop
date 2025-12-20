<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { PluginManifest } from "../../script/service/PluginLoader";
import { PluginRuntime } from "../../script/service/plugin/PluginRuntime";

const props = defineProps<{
  manifest: PluginManifest;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const mountEl = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
const loading = ref(false);

let runtime: PluginRuntime | null = null;

const { t } = useI18n();
const title = computed(() => props.manifest?.name ?? t('plugin_default_title'));

async function stop(): Promise<void> {
  if (!runtime) return;
  const current = runtime;
  runtime = null;
  await current.stop();
}

async function start(): Promise<void> {
  await stop();

  const el = mountEl.value;
  if (!el) return;

  loading.value = true;
  error.value = null;

  runtime = new PluginRuntime(props.manifest, el);

  try {
    await runtime.start();
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.manifest,
  () => {
    start();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  stop();
});
</script>

<template>
  <div class="plugin-host">
    <div class="header">
      <div class="title">{{ title }}</div>
      <button class="close" type="button" @click="emit('close')">{{ $t('back') }}</button>
    </div>

    <div class="body">
      <div ref="mountEl" class="mount"></div>
      <div v-if="loading" class="overlay">{{ $t('loading') }}</div>
      <div v-else-if="error" class="overlay error">{{ error }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.plugin-host {
  position: fixed;
  left: 318px;
  top: 61px;
  width: calc(100vw - 318px);
  height: calc(100vh - 61px);
  background: rgba(243, 244, 246, 1);
  border-left: 1px solid rgba(231, 232, 236, 1);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid rgba(227, 229, 233, 1);
  background: rgba(245, 245, 245, 1);
}

.title {
  font-weight: 600;
  font-size: 14px;
}

.close {
  height: 28px;
  border-radius: 8px;
  padding: 0 10px;
  border: 1px solid rgba(59, 130, 246, 0.7);
  background: rgba(59, 130, 246, 0.15);
  cursor: pointer;
}

.body {
  position: relative;
  flex: 1;
  overflow: hidden;
}

.mount {
  width: 100%;
  height: 100%;
  overflow: auto;
  background: white;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(17, 24, 39, 0.6);
  color: #e5e7eb;
  font-size: 12px;
}

.overlay.error {
  background: rgba(127, 29, 29, 0.8);
}
</style>
