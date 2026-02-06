<script setup lang="ts">
/**
 * @fileoverview ServerRail.vue
 * @description Patchbay 左侧服务器栏（Rack 列表 + 快捷入口）。
 */

type ServerRackItem = {
  /**
   * 服务器展示名称。
   */
  name: string;
  /**
   * 服务器 socket（host:port 或 ws/http 地址等）。
   */
  serverSocket: string;
};

const props = defineProps<{
  /**
   * 服务器机架列表。
   */
  racks: ServerRackItem[];
  /**
   * 当前激活的 server socket。
   */
  activeSocket: string;
}>();

const emit = defineEmits<{
  /**
   * 用户切换服务器。
   */
  (e: "switch", serverSocket: string): void;
  /**
   * 打开服务器管理页。
   */
  (e: "open-servers"): void;
  /**
   * 打开插件中心页。
   */
  (e: "open-plugins"): void;
  /**
   * 打开设置页。
   */
  (e: "open-settings"): void;
}>();
</script>

<template>
  <!-- 组件：ServerRail｜职责：服务器栏（Rack 列表 + 快捷入口） -->
  <!-- 区块：<aside> .cp-rail--servers -->
  <aside class="cp-rail cp-rail--servers">
    <div class="cp-rail__title">RACKS</div>
    <div class="cp-rackList" role="listbox" aria-label="servers">
      <button
        v-for="s in props.racks"
        :key="s.serverSocket"
        class="cp-rack"
        type="button"
        :data-active="s.serverSocket === props.activeSocket"
        @click="emit('switch', s.serverSocket)"
      >
        <span class="cp-rack__led" aria-hidden="true"></span>
        <span class="cp-rack__name">{{ s.name }}</span>
      </button>
    </div>
    <div class="cp-rail__foot">
      <button class="cp-rail__btn" type="button" @click="emit('open-servers')">Servers</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-plugins')">Modules</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-settings')">Settings</button>
    </div>
  </aside>
</template>
