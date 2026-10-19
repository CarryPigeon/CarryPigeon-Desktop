<script setup lang="ts">
/**
 * @fileoverview PluginCenterGridHeader.vue
 * @description plugins｜组件：PluginCenterGridHeader。
 *
 * 职责：
 * - 渲染插件中心右侧内容区的头部（返回/标题/服务端元信息/操作按钮）。
 * - 以事件形式向上抛出交互（刷新/跳转 Domains/返回上一页）。
 */

import { useI18n } from "vue-i18n";
import BackButton from "@/shared/ui/BackButton.vue";

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
   * 用户点击“返回”按钮。
   */
  back: [];
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
 * 返回上一页（统一返回控件）。
 */
function handleBack(): void {
  emit("back");
}
</script>

<template>
  <!-- 组件：PluginCenterGridHeader｜职责：渲染插件中心右侧头部（返回/标题/元信息/操作按钮） -->
  <header class="cp-plugins__head">
    <BackButton test-id="plugin-center-back" @click="handleBack" />
    <div class="cp-plugins__headLeft">
      <div class="cp-plugins__headTitle">{{ t("plugin_center") }}</div>
      <div class="cp-plugins__headMeta">
        <span class="cp-plugins__mono">{{ serverSocket || t("plugins_no_server") }}</span>
        <span class="cp-plugins__dot"></span>
        <span class="cp-plugins__mono">{{ serverId || t("plugins_missing_server_id") }}</span>
        <span class="cp-plugins__dot"></span>
        <span class="cp-plugins__muted">{{ modulesCount }} {{ t("plugins_modules_suffix") }}</span>
      </div>
    </div>
    <div class="cp-plugins__headRight">
      <button class="cp-plugins__headBtn" type="button" @click="handleRefresh">{{ t("refresh") }}</button>
      <button class="cp-plugins__headBtn" type="button" @click="handleOpenDomains">{{ t("plugin_center_domains") }}</button>
    </div>
  </header>
</template>

<style scoped lang="scss">
/* 样式：插件中心头部｜规格：面板内分区头（标题 18px + mono 元信息 + 胶囊操作） */
.cp-plugins__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--cp-border-light);
}

.cp-plugins__headLeft {
  min-width: 0;
}

.cp-plugins__headTitle {
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 18px;
  line-height: 1.2;
  letter-spacing: 0.04em;
  color: var(--cp-text);
}

.cp-plugins__headMeta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.cp-plugins__mono {
  min-width: 0;
  font-family: var(--cp-font-mono);
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--cp-text-muted);
  overflow-wrap: anywhere;
}

.cp-plugins__dot {
  flex: 0 0 auto;
  width: 3px;
  height: 3px;
  border-radius: 999px;
  background: var(--cp-text-light);
}

.cp-plugins__muted {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-plugins__headRight {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

/* 操作按钮：统一胶囊规格 */
.cp-plugins__headBtn {
  @include cp-pill-button;
}
</style>
