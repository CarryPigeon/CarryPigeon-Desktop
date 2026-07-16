<script setup lang="ts">
import { reactive } from "vue";
import type { Component, ComponentPublicInstance } from "vue";

// 全局浮层容器：插件经 host.mountOverlay 注册组件，此处统一渲染。
type OverlayEntry = { id: number; component: Component; zIndex: number; props?: Record<string, unknown> };
const overlays = reactive<OverlayEntry[]>([]);
// 组件实例表：mount 返回句柄的 instance 通过 getter 实时读取。
const instances = new Map<number, ComponentPublicInstance | null>();
let seq = 0;

function setInstance(id: number, el: ComponentPublicInstance | null): void {
  instances.set(id, el);
}

function mount(component: Component, opts?: { zIndex?: number; props?: Record<string, unknown> }): { unmount: () => void; instance: ComponentPublicInstance | null } {
  const id = ++seq;
  overlays.push({ id, component, zIndex: opts?.zIndex ?? 1000, props: opts?.props });
  return {
    unmount: () => {
      const i = overlays.findIndex((o) => o.id === id);
      if (i >= 0) overlays.splice(i, 1);
      instances.delete(id);
    },
    get instance() {
      return instances.get(id) ?? null;
    },
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
      <component
        :is="o.component"
        v-bind="o.props ?? {}"
        :ref="(el: unknown) => setInstance(o.id, (el as ComponentPublicInstance | null))"
      />
    </div>
  </div>
</template>

<style scoped>
.plugin-overlay-root { position: fixed; inset: 0; pointer-events: none; }
.plugin-overlay-layer { position: absolute; inset: 0; pointer-events: auto; }
</style>
