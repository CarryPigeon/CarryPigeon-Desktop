<template>
  <div class="group-notice-bubble" :class="`group-notice-bubble--${level}`">
    <div class="group-notice-bubble__header">
      <t-icon name="notification" class="group-notice-bubble__icon" />
      <span class="group-notice-bubble__title">{{ notice.title }}</span>
      <span class="group-notice-bubble__level">{{ levelLabel }}</span>
    </div>
    <div class="group-notice-bubble__body">{{ notice.body }}</div>
    <div v-if="formattedTime" class="group-notice-bubble__time">{{ formattedTime }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { GroupNotice, GroupNoticeLevel } from "../domain/groupNotice";

/**
 * 通用插件消息渲染契约（由宿主 MessageContentHost 的 plugin 分支传入）。
 * data 形状：{ noticeId?, title, body, level: "info"|"warning"|"critical", issuedAt? }
 */
const props = defineProps<{
  data?: unknown;
  context?: unknown;
  preview?: unknown;
  domain?: string;
  domainVersion?: string;
  mid?: string;
  from?: { id: string; name: string };
  timeMs?: number;
  replyToMid?: string;
}>();

const LEVEL_LABELS: Record<GroupNoticeLevel, string> = {
  info: "INFO",
  warning: "WARNING",
  critical: "CRITICAL",
};

/** 从消息 data 提取通知内容，缺失字段以安全默认值兜底。 */
const notice = computed<GroupNotice>(() => {
  const d = (props.data ?? {}) as Record<string, unknown>;
  const levelRaw = String(d.level ?? "").trim() as GroupNoticeLevel;
  const level: GroupNoticeLevel =
    levelRaw === "warning" || levelRaw === "critical" ? levelRaw : "info";
  const issuedAtRaw = d.issuedAt ?? d.issued_at;
  const issuedAtNum = Number(issuedAtRaw);
  return {
    noticeId: String(d.noticeId ?? d.notice_id ?? ""),
    title: String(d.title ?? ""),
    body: String(d.body ?? ""),
    level,
    issuedAt: Number.isFinite(issuedAtNum) ? issuedAtNum : 0,
  };
});

const level = computed(() => notice.value.level);
const levelLabel = computed(() => LEVEL_LABELS[level.value]);

const formattedTime = computed(() => {
  const ms = notice.value.issuedAt;
  if (!ms) return "";
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
});
</script>

<style scoped lang="scss">
// 按 level 着色：info 蓝灰 / warning 橙 / critical 红。
.group-notice-bubble {
  max-width: 280px;
  border: 1px solid var(--cp-border);
  border-left-width: 4px;
  border-radius: 8px;
  background: var(--cp-surface);
  padding: 10px 12px;
  font-size: 13px;

  &--info {
    border-left-color: var(--td-brand-color, #0052d9);

    .group-notice-bubble__level {
      color: var(--td-brand-color, #0052d9);
    }
  }

  &--warning {
    border-left-color: var(--td-warning-color, #ed7b2f);

    .group-notice-bubble__level,
    .group-notice-bubble__icon {
      color: var(--td-warning-color, #ed7b2f);
    }
  }

  &--critical {
    border-left-color: var(--td-error-color, #d54941);

    .group-notice-bubble__level,
    .group-notice-bubble__icon {
      color: var(--td-error-color, #d54941);
    }
  }

  &__header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-weight: 500;
    color: var(--cp-text);
  }

  &__title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__level {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }

  &__body {
    color: var(--cp-text);
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__time {
    margin-top: 6px;
    font-size: 11px;
    color: var(--cp-text-muted, #999);
  }
}
</style>
