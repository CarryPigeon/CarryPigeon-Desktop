<script setup lang="ts">
/**
 * @fileoverview UnknownDomainCard.vue
 * @description Unpatched Signal downgrade card (unknown domain renderer).
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
        <div class="cp-unpatched__titleEn">{{ props.title || "UNPATCHED SIGNAL" }}</div>
        <div class="cp-unpatched__titleZh">{{ t("unpatched_signal") }}</div>
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
      <button class="cp-unpatched__btn primary" type="button" @click="emit('install')">
        {{ t("install_module_to_view") }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* UnknownDomainCard styles */
/* Selector: `.cp-unpatched` — downgrade card container for unknown domain signals. */
.cp-unpatched {
  border: 1px dashed rgba(148, 163, 184, 0.34);
  background: var(--cp-panel-muted);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--cp-shadow-soft);
}

/* Selector: `.cp-unpatched__top` — header row (title + tags). */
.cp-unpatched__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

/* Selector: `.cp-unpatched__title` — title stack wrapper. */
.cp-unpatched__title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Selector: `.cp-unpatched__titleEn` — English title (industrial label). */
.cp-unpatched__titleEn {
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text);
}

/* Selector: `.cp-unpatched__titleZh` — localized subtitle. */
.cp-unpatched__titleZh {
  font-size: 12px;
  color: var(--cp-text-muted);
}

/* Selector: `.cp-unpatched__tags` — right-aligned metadata tags. */
.cp-unpatched__tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Selector: `.cp-unpatched__body` — content row (preview + decorative cable). */
.cp-unpatched__body {
  margin-top: 10px;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
}

/* Selector: `.cp-unpatched__preview` — preview text (must wrap long tokens). */
.cp-unpatched__preview {
  font-size: 12px;
  line-height: 1.45;
  color: var(--cp-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  min-width: 0;
}

/* Selector: `.cp-unpatched__cable` — decorative broken cable glyph container. */
.cp-unpatched__cable {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Selector: `.cp-unpatched__cableDot` — cable endpoint dot. */
.cp-unpatched__cableDot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
}

/* Selector: `.cp-unpatched__cableDash` — dashed cable segment. */
.cp-unpatched__cableDash {
  width: 56px;
  height: 1px;
  background: repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.62), rgba(148, 163, 184, 0.62) 6px, transparent 6px, transparent 12px);
  opacity: 0.8;
}

/* Selector: `.cp-unpatched__actions` — footer row (CTA alignment). */
.cp-unpatched__actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

/* Selector: `.cp-unpatched__btn` — CTA button base. */
.cp-unpatched__btn {
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

/* Selector: `.cp-unpatched__btn:hover` — hover lift + highlight border. */
.cp-unpatched__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: var(--cp-highlight-border);
}

/* Selector: `.cp-unpatched__btn.primary` — primary CTA styling. */
.cp-unpatched__btn.primary {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
}

/* Selector: `.cp-unpatched__btn.primary:hover` — stronger hover for CTA. */
.cp-unpatched__btn.primary:hover {
  border-color: var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg-strong);
}
</style>
