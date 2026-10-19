<script setup lang="ts">
/**
 * @fileoverview UnknownDomainCard.vue
 * @description chat｜组件：UnknownDomainCard。
 */

import { useI18n } from "vue-i18n";
import MonoTag from "@/shared/ui/MonoTag.vue";

const props = defineProps<{
  title?: string;
  domainId: string;
  domainVersion?: string;
  pluginIdHint?: string;
  preview: string;
}>();

const emit = defineEmits<{
  (e: "install"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- 组件：UnknownDomainCard｜职责：未知 domain 降级卡 -->
  <!-- 区块：<div> .cp-unpatched -->
  <div class="cp-unpatched">
    <div class="cp-unpatched__top">
      <div class="cp-unpatched__title">
        <div class="cp-unpatched__titleZh">{{ t("unpatched_signal") }}</div>
        <div class="cp-unpatched__titleEn">{{ props.title || "UNPATCHED SIGNAL" }}</div>
      </div>
      <div class="cp-unpatched__tags">
        <MonoTag :value="props.domainId" title="domain" :copyable="true" />
        <MonoTag v-if="props.domainVersion" :value="props.domainVersion" title="version" :copyable="true" />
        <MonoTag v-if="props.pluginIdHint" :value="props.pluginIdHint" title="plugin_id" :copyable="true" />
      </div>
    </div>

    <div class="cp-unpatched__body">
      <div class="cp-unpatched__preview">{{ props.preview || t("preview_unavailable") }}</div>
      <div class="cp-unpatched__cable" aria-hidden="true">
        <span class="cp-unpatched__cableDot"></span>
        <span class="cp-unpatched__cableDash"></span>
        <span class="cp-unpatched__cableDot"></span>
      </div>
    </div>

    <div class="cp-unpatched__actions">
      <!-- 说明：该消息的消息域由未安装的插件提供，安装后才能渲染完整内容（降级引导）。 -->
      <button
        class="cp-unpatched__btn primary"
        type="button"
        :title="t('install_module_to_view')"
        @click="emit('install')"
      >
        {{ t("install_module_to_view") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：UnknownDomainCard｜布局与变量说明：卡片包含标题/标签区、预览区与安装引导按钮；
   降级态用 dashed 边框 + panel-muted 底，安装按钮为主操作（highlight）。 */
.cp-unpatched {
  border: 1px dashed var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: var(--cp-radius-card);
  padding: 12px;
}

.cp-unpatched__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.cp-unpatched__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cp-unpatched__titleEn {
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: var(--cp-text-muted);
}

/* 中文主标题（统一中文文案后为主行） */
.cp-unpatched__titleZh {
  font-family: var(--cp-font-display);
  letter-spacing: 0.06em;
  font-size: 13px;
  color: var(--cp-text);
}

.cp-unpatched__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.cp-unpatched__body {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

.cp-unpatched__preview {
  font-size: 12px;
  line-height: 1.45;
  color: var(--cp-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

/* 未接通线缆示意：颜色取自 domain 未知识别色 */
.cp-unpatched__cable {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cp-unpatched__cableDot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: color-mix(in oklab, var(--cp-domain-unknown) 42%, transparent);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--cp-domain-unknown) 12%, transparent);
}

.cp-unpatched__cableDash {
  width: 56px;
  height: 1px;
  background: repeating-linear-gradient(
    90deg,
    color-mix(in oklab, var(--cp-domain-unknown) 62%, transparent),
    color-mix(in oklab, var(--cp-domain-unknown) 62%, transparent) 6px,
    transparent 6px,
    transparent 12px
  );
  opacity: 0.8;
}

.cp-unpatched__actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

/* 安装引导：胶囊按钮；primary 用 highlight 主操作语义 */
.cp-unpatched__btn {
  @include cp-pill-button;

  &.primary {
    @include cp-pill-button(primary);
  }
}
</style>
