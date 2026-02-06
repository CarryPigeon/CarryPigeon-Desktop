<script setup lang="ts">
/**
 * @fileoverview PluginCenterGridHeader.vue
 * @description plugins｜组件：PluginCenterGridHeader。
 *
 * 职责：
 * - 渲染插件中心右侧内容区的头部（标题/服务端元信息/操作按钮）。
 * - 以事件形式向上抛出交互（刷新/跳转 Domains/返回 Chat）。
 */

import { useI18n } from "vue-i18n";

type Props = {
  /**
   * 当前 server socket（可为空）。
   */
  serverSocket?: string;
  /**
   * 当前 serverId（可为空）。
   */
  serverId?: string;
  /**
   * 当前网格展示的模块数量。
   */
  modulesCount: number;
};

defineProps<Props>();

const emit = defineEmits<{
  /**
   * 用户点击“刷新”按钮。
   */
  refresh: [];
  /**
   * 用户点击“Domains”按钮。
   */
  openDomains: [];
  /**
   * 用户点击“返回 Patchbay”按钮。
   */
  backToChat: [];
}>();

const { t } = useI18n();

/**
 * 触发刷新事件。
 */
function handleRefresh(): void {
  emit("refresh");
}

/**
 * 跳转到 Domains 页面。
 */
function handleOpenDomains(): void {
  emit("openDomains");
}

/**
 * 返回 Chat（Patchbay）。
 */
function handleBackToChat(): void {
  emit("backToChat");
}
</script>

<template>
  <!-- 组件：PluginCenterGridHeader｜职责：渲染插件中心右侧头部（标题/元信息/操作按钮） -->
  <header class="cp-plugins__head">
    <div class="cp-plugins__headLeft">
      <div class="cp-plugins__headTitle">{{ t("plugin_center") }}</div>
      <div class="cp-plugins__headMeta">
        <span class="cp-plugins__mono">{{ serverSocket || "no-server" }}</span>
        <span class="cp-plugins__dot"></span>
        <span class="cp-plugins__mono">{{ serverId || "missing-server_id" }}</span>
        <span class="cp-plugins__dot"></span>
        <span class="cp-plugins__muted">{{ modulesCount }} modules</span>
      </div>
    </div>
    <div class="cp-plugins__headRight">
      <button class="cp-plugins__headBtn" type="button" @click="handleRefresh">{{ t("refresh") }}</button>
      <button class="cp-plugins__headBtn" type="button" @click="handleOpenDomains">Domains</button>
      <button class="cp-plugins__headBtn" type="button" @click="handleBackToChat">{{ t("back_to_patchbay") }}</button>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 布局与变量说明：右侧内容区头部样式复用 `cp-plugins__*` 前缀，颜色取自全局 `--cp-*` 变量。 */
.cp-plugins__head {
  padding: 14px 14px 12px 14px;
  border-bottom: 1px solid var(--cp-border-light);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.cp-plugins__headTitle {
  font-family: var(--cp-font-display);
  font-weight: 800;
  letter-spacing: 0.04em;
  font-size: 18px;
  color: var(--cp-text);
}

.cp-plugins__headMeta {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-plugins__mono {
  font-family: var(--cp-font-mono);
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugins__dot {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.5);
}

.cp-plugins__muted {
  font-size: 12px;
  color: var(--cp-text-muted);
}

.cp-plugins__headRight {
  display: flex;
  gap: 10px;
}

.cp-plugins__headBtn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-plugins__headBtn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}
</style>
