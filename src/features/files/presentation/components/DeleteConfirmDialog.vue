<script setup lang="ts">
/**
 * @fileoverview DeleteConfirmDialog.vue
 * @description files｜删除确认弹窗。
 */

import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  visible: boolean;
  count: number;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();
</script>

<template>
  <!-- 组件：DeleteConfirmDialog｜职责：删除确认（危险状态 token + 玻璃浮层） -->
  <Teleport to="body">
    <div v-if="visible" class="cp-deleteOverlay" @click.self="emit('cancel')">
      <div class="cp-deleteDialog" role="dialog" aria-modal="true" :aria-label="t('file_delete_confirm_title')">
        <div class="cp-deleteDialog__icon"><AppIcon name="delete" :size="24" /></div>
        <div class="cp-deleteDialog__title">{{ t("file_delete_confirm_title") }}</div>
        <div class="cp-deleteDialog__msg">
          {{ t("file_delete_confirm_message", { count }) }}
        </div>
        <div class="cp-deleteDialog__actions">
          <button class="cp-deleteDialog__btn" type="button" @click="emit('cancel')">{{ t("cancel") }}</button>
          <button class="cp-deleteDialog__btn cp-deleteDialog__btn--danger" type="button" @click="emit('confirm')">
            {{ t("confirm") }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
/* 样式：删除确认弹窗｜规格：面板实底浮层 + danger 状态 token + 胶囊按钮 */
.cp-deleteOverlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.34);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 10000;
}

.cp-deleteDialog {
  width: min(400px, 92vw);
  padding: 24px;
  text-align: center;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-lg);
  background: var(--cp-panel-solid);
  box-shadow: var(--cp-shadow-float);
}

/* 图标瓦片：danger 底色/描边 */
.cp-deleteDialog__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 14px;
  border: 1px solid var(--cp-danger-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-danger-bg);
  color: var(--cp-danger);
}

.cp-deleteDialog__title {
  margin-bottom: 8px;
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 17px;
  letter-spacing: 0.02em;
  color: var(--cp-text);
}

.cp-deleteDialog__msg {
  margin-bottom: 20px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--cp-text-muted);
}

.cp-deleteDialog__actions {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cp-deleteDialog__btn {
  @include cp-pill-button;
}

/* 危险主操作：实底 danger token（hover 用透明度混合保持主题无关） */
.cp-deleteDialog__btn--danger {
  @include cp-pill-button(danger);

  border-color: var(--cp-danger);
  background: var(--cp-danger);
  color: var(--cp-panel-solid);
}

.cp-deleteDialog__btn--danger:hover:not(:disabled) {
  border-color: var(--cp-danger);
  background: color-mix(in oklab, var(--cp-danger) 88%, transparent);
  color: var(--cp-panel-solid);
}
</style>
