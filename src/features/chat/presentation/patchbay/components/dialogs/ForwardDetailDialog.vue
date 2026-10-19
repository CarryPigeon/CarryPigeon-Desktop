<script setup lang="ts">
/**
 * @fileoverview ForwardDetailDialog.vue
 * @description chat｜组件：转发消息详情弹窗，展示合并转发消息的完整内容。
 */

import { useI18n } from "vue-i18n";
import type { ForwardedMessageEntry } from "@/features/chat/message-flow/message/domain/messageModels";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  visible: boolean;
  fromName: string;
  forwardedMessages: ForwardedMessageEntry[];
  comment?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const { t } = useI18n();

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function handleClose(): void {
  emit("close");
}
</script>

<template>
  <t-dialog
    :visible="props.visible"
    :header="t('forward_detail_title', { name: props.fromName })"
    :footer="false"
    width="480px"
    @close="handleClose"
  >
    <div class="cp-forwardDetail">
      <div class="cp-forwardDetail__header">
        <span class="cp-forwardDetail__icon"><AppIcon name="clipboard" /></span>
        <span class="cp-forwardDetail__title">
          {{ t("forwarded_messages_count", { name: props.fromName, count: props.forwardedMessages.length }) }}
        </span>
      </div>
      <div v-if="props.comment" class="cp-forwardDetail__comment">
        {{ props.comment }}
      </div>
      <div class="cp-forwardDetail__messages">
        <div
          v-for="(fm, idx) in props.forwardedMessages"
          :key="`fd-${idx}`"
          class="cp-forwardDetail__msg"
        >
          <div class="cp-forwardDetail__msgMeta">
            <span class="cp-forwardDetail__msgAuthor">{{ fm.authorName || fm.userId }}</span>
            <span class="cp-forwardDetail__msgTime">{{ fmtTime(fm.sentTime) }}</span>
          </div>
          <div class="cp-forwardDetail__msgPreview">
            {{ fm.preview || "..." }}
          </div>
        </div>
      </div>
      <div class="cp-forwardDetail__actions">
        <button class="cp-forwardDetail__btn" type="button" @click="handleClose">
          {{ t("close") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
/* 样式：ForwardDetailDialog｜规格：引用块 + 分组行列表 + 胶囊按钮 */
.cp-forwardDetail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-forwardDetail__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--cp-text-muted);
}

.cp-forwardDetail__icon {
  flex-shrink: 0;
}

.cp-forwardDetail__title {
  font-weight: 500;
}

/* 转发附言：信息引用语义（info 状态条 + 左侧色条） */
.cp-forwardDetail__comment {
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cp-text);
  border-radius: var(--cp-radius-control);
  border: 1px solid var(--cp-info-border);
  border-left: 3px solid var(--cp-info);
  background: var(--cp-info-bg);
  word-break: break-word;
}

/* 消息列表：内嵌卡片 + 行分隔 */
.cp-forwardDetail__messages {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
  overflow: hidden;
  max-height: 360px;
  overflow-y: auto;
}

.cp-forwardDetail__msg {
  padding: 10px 12px;
  border-top: 1px solid var(--cp-border-light);

  &:first-child {
    border-top: none;
  }
}

.cp-forwardDetail__msgMeta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.cp-forwardDetail__msgAuthor {
  font-size: 13px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-forwardDetail__msgTime {
  font-size: 11px;
  color: var(--cp-text-muted);
}

.cp-forwardDetail__msgPreview {
  font-size: 12.5px;
  color: var(--cp-text-muted);
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}

.cp-forwardDetail__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.cp-forwardDetail__btn {
  @include cp-pill-button;
}
</style>
