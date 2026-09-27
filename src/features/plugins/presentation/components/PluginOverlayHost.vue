<script setup lang="ts">
import { markRaw, reactive } from "vue";
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
  // markRaw：插件组件定义不需要响应式（否则触发 Vue「component made reactive」告警并带来无谓开销）。
  overlays.push({ id, component: markRaw(component), zIndex: opts?.zIndex ?? 1000, props: opts?.props });
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
  <!--
    Teleport 到 body：宿主挂载点（.cp-center）带 backdrop-filter，会成为
    position:fixed 后代的「包含块 + 层叠上下文」，插件浮层因此被困在中央栏内，
    z-index 也只在中央栏子树内比较，消息气泡等后绘内容会盖住面板。
    挂到 body 后 fixed 以视口定位，z-index 与全局弹层同层比较（无浮层时
    Teleport 不渲染任何节点，行为同空 v-for）。
  -->
  <Teleport to="body">
    <div class="plugin-overlay-root">
      <div
        v-for="o in overlays"
        :key="o.id"
        class="plugin-overlay-layer"
        :style="{ zIndex: o.zIndex, pointerEvents: 'none' }"
      >
        <component
          :is="o.component"
          v-bind="o.props ?? {}"
          :ref="(el: unknown) => setInstance(o.id, (el as ComponentPublicInstance | null))"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * 浮层容器本身永不拦截点击：只有插件自己渲染出来的内容才接管指针事件。
 * 注意：分层容器若 `inset: 0` + `pointer-events: auto`，就会变成一层铺满全屏的透明空壳，
 * 盖在宿主之上吃掉所有点击（现象：界面看起来正常，但所有按钮都点不动）。
 * 自带插件（group-notice / ai-summary）在激活时会常驻挂载浮层，因此该回归会随插件启用而必现。
 */
.plugin-overlay-root { position: fixed; inset: 0; pointer-events: none; }
.plugin-overlay-layer { position: absolute; inset: 0; pointer-events: none; }
</style>

<style>
/* 全局（非 scoped）生效：把指针事件交还给插件渲染出的根元素及其子树。
   放在非 scoped 块中，避免依赖「父组件 scopeId 会落到子组件根节点」这一隐式行为。 */
.plugin-overlay-layer > * { pointer-events: auto; }
</style>
