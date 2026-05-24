<script setup lang="ts">
/**
 * @fileoverview ServerRail.vue
 * @description Patchbay 左侧服务器栏（Rack 列表 + 快捷入口）。
 */

import { useI18n } from "vue-i18n";

const { t } = useI18n();

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
  racks: readonly Readonly<ServerRackItem>[];
  /**
   * 当前激活的 server socket。
   */
  activeSocket: string;
  /**
   * 当前服务器是否处于免打扰（静音）状态。
   */
  serverMuted: boolean;
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
  (e: "open-files"): void;
  /**
   * 切换服务器免打扰状态。
   */
  (e: "toggle-mute"): void;
}>();
</script>

<template>
  <!-- 组件：ServerRail｜职责：服务器栏（Rack 列表 + 快捷入口） -->
  <!-- 区块：<aside> .cp-rail--servers -->
  <aside class="cp-rail cp-rail--servers">
    <div class="cp-rail__title">Servers</div>
    <div v-if="props.racks.length === 0" class="cp-rail__empty">No servers added yet.</div>
    <div v-else class="cp-rackList" role="listbox" aria-label="servers">
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
    <button
      class="cp-serverRail__mute"
      type="button"
      :title="props.serverMuted ? t('unmute_server') : t('mute_server')"
      @click="emit('toggle-mute')"
    >
      {{ props.serverMuted ? '🔇' : '🔊' }}
    </button>
    <div class="cp-rail__foot">
      <button class="cp-rail__btn" type="button" @click="emit('open-servers')">Manage</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-plugins')">Plugins</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-settings')">{{ t("settings_title") }}</button>
      <button class="cp-rail__btn" type="button" @click="emit('open-files')">{{ t("file_manager") }}</button>
    </div>
  </aside>
</template>
