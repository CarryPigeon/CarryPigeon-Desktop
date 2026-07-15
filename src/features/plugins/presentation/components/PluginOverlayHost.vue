<script setup lang="ts">
import { reactive } from "vue";
import type { Component } from "vue";

// 全局浮层容器：插件经 host.mountOverlay 注册组件，此处统一渲染。
type OverlayEntry = { id: number; component: Component; zIndex: number };
const overlays = reactive<OverlayEntry[]>([]);
let seq = 0;

function mount(component: Component, opts?: { zIndex?: number }): () => void {
  const id = ++seq;
  overlays.push({ id, component, zIndex: opts?.zIndex ?? 1000 });
  return () => {
    const i = overlays.findIndex((o) => o.id === id);
    if (i >= 0) overlays.splice(i, 1);
  };
}

defineExpose({ mount });
</script>

<template>
  <div class="plugin-overlay-root">
    <div
      v-for="o in overlays"
      :key="o.id"
      class="plugin-overlay-layer"
      :style="{ zIndex: o.zIndex }"
    >
      <component :is="o.component" />
    </div>
  </div>
</template>

<style scoped>
.plugin-overlay-root { position: fixed; inset: 0; pointer-events: none; }
.plugin-overlay-layer { position: absolute; inset: 0; pointer-events: auto; }
</style>
