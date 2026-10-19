<script setup lang="ts">
/**
 * @fileoverview code-review｜presentation｜可评论的代码块。
 * @description
 * 为聊天消息中的 triple-backtick 代码块提供行号、行点击评论、评论展示。
 * v0.4.0 注释仅保存在当前设备的 localStorage 中。
 */

import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { CodeReviewComment } from "@/features/chat/message-flow/code-review/domain/codeReviewModels";
import {
  loadCodeReviewComments,
  saveCodeReviewComments,
  deleteCodeReviewComment,
} from "@/features/chat/message-flow/code-review/storage/codeReviewStorage";

const props = defineProps<{
  /** 代码块内容（不含围栏）。 */
  code: string;
  /** 代码语言（可能为空）。 */
  language?: string;
  /** 代码块在消息中的索引。 */
  blockIndex: number;
  /** 所属消息 id。 */
  messageId: string;
  /** 所属频道 id（用于本地存储分区）。 */
  channelId: string;
  /** 当前用户 id。 */
  currentUserId: string;
  /** 当前用户显示名。 */
  currentUserName: string;
}>();

const { t } = useI18n();

const lines = computed(() => props.code.split("\n"));
const comments = ref<CodeReviewComment[]>([]);
const activeLine = ref<number | null>(null);
const draftText = ref("");

function refreshComments(): void {
  comments.value = loadCodeReviewComments(props.channelId, props.messageId);
}

watch(
  () => [props.channelId, props.messageId],
  () => refreshComments(),
  { immediate: true },
);

const commentsByLine = computed(() => {
  const map = new Map<number, CodeReviewComment[]>();
  for (const c of comments.value) {
    if (c.codeBlockIndex !== props.blockIndex) continue;
    const list = map.get(c.lineNumber) ?? [];
    list.push(c);
    map.set(c.lineNumber, list);
  }
  return map;
});

function commentsOn(line: number): CodeReviewComment[] {
  return commentsByLine.value.get(line) ?? [];
}

function hasComments(line: number): boolean {
  return commentsOn(line).length > 0;
}

function startReview(line: number): void {
  activeLine.value = line;
  draftText.value = "";
}

function cancelReview(): void {
  activeLine.value = null;
  draftText.value = "";
}

function submitReview(): void {
  const text = draftText.value.trim();
  if (!text || activeLine.value == null) return;

  const comment: CodeReviewComment = {
    commentId: generateId(),
    messageId: props.messageId,
    codeBlockIndex: props.blockIndex,
    lineNumber: activeLine.value,
    authorId: props.currentUserId,
    authorName: props.currentUserName,
    text,
    createdAt: Date.now(),
  };

  comments.value.push(comment);
  saveCodeReviewComments(props.channelId, props.messageId, comments.value);
  cancelReview();
}

function removeComment(commentId: string): void {
  deleteCodeReviewComment(props.channelId, props.messageId, commentId);
  refreshComments();
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `crc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
</script>

<template>
  <div class="cp-codeBlock">
    <div v-if="language" class="cp-codeBlock__lang">{{ language }}</div>
    <div class="cp-codeBlock__lines">
      <div
        v-for="(line, idx) in lines"
        :key="`${messageId}-${blockIndex}-${idx}`"
        class="cp-codeBlock__line"
        :class="{ 'cp-codeBlock__line--active': activeLine === idx + 1 }"
        @click.self="startReview(idx + 1)"
      >
        <span class="cp-codeBlock__lineNumber">{{ idx + 1 }}</span>
        <span class="cp-codeBlock__lineContent">{{ line || " " }}</span>
        <span
          v-if="hasComments(idx + 1)"
          class="cp-codeBlock__commentBadge"
          :title="t('code_review_comment_count', { count: commentsOn(idx + 1).length })"
        >
          {{ commentsOn(idx + 1).length }}
        </span>

        <div
          v-if="commentsOn(idx + 1).length > 0"
          class="cp-codeBlock__comments"
          @click.stop
        >
          <div
            v-for="c in commentsOn(idx + 1)"
            :key="c.commentId"
            class="cp-codeBlock__comment"
          >
            <div class="cp-codeBlock__commentMeta">
              <span class="cp-codeBlock__commentAuthor">{{ c.authorName }}</span>
              <span class="cp-codeBlock__commentTime">{{ formatTime(c.createdAt) }}</span>
            </div>
            <div class="cp-codeBlock__commentText">{{ c.text }}</div>
            <button
              v-if="c.authorId === currentUserId"
              class="cp-codeBlock__commentDelete"
              type="button"
              @click="removeComment(c.commentId)"
            >
              {{ t('delete') }}
            </button>
          </div>
        </div>

        <div
          v-if="activeLine === idx + 1"
          class="cp-codeBlock__reviewInput"
          @click.stop
        >
          <textarea
            v-model="draftText"
            class="cp-codeBlock__reviewTextarea"
            :placeholder="t('code_review_add_comment')"
            rows="2"
          ></textarea>
          <div class="cp-codeBlock__reviewActions">
            <button type="button" class="cp-codeBlock__reviewBtn cp-codeBlock__reviewBtn--primary" @click="submitReview">
              {{ t('send') }}
            </button>
            <button type="button" class="cp-codeBlock__reviewBtn" @click="cancelReview">
              {{ t('cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：CodeBlockReviewable｜规格：代码卡片 + 行 hover/选中 highlight + 胶囊按钮 */
.cp-codeBlock {
  background: var(--cp-panel-muted);
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-control);
  margin: 6px 0;
  overflow: hidden;
  font-family: var(--cp-font-mono);
  font-size: 12px;
  line-height: 1.6;
}

.cp-codeBlock__lang {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--cp-text-muted);
  background: var(--cp-panel);
  border-bottom: 1px solid var(--cp-border-light);
  text-transform: uppercase;
}

.cp-codeBlock__lines {
  padding: 6px 0;
}

.cp-codeBlock__line {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: start;
  padding: 0 10px 0 0;
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-codeBlock__line:hover {
  background: var(--cp-hover-bg);
}

.cp-codeBlock__line--active {
  background: var(--cp-highlight-bg);
  box-shadow: inset 2px 0 0 var(--cp-highlight);
}

.cp-codeBlock__lineNumber {
  text-align: right;
  padding: 0 10px;
  color: var(--cp-text-light);
  user-select: none;
}

.cp-codeBlock__lineContent {
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--cp-text);
}

.cp-codeBlock__commentBadge {
  align-self: center;
  min-width: 16px;
  height: 16px;
  margin-left: 8px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--cp-highlight);
  /* 徽标反色文字固定白色，保证在 highlight 底色上可读 */
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

/* 评论/输入区：内嵌卡片 */
.cp-codeBlock__comments,
.cp-codeBlock__reviewInput {
  grid-column: 1 / -1;
  margin: 4px 10px 8px 46px;
  padding: 8px;
  border-radius: var(--cp-radius-sm);
  background: var(--cp-panel);
  border: 1px solid var(--cp-border-light);
}

.cp-codeBlock__comment + .cp-codeBlock__comment {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-codeBlock__commentMeta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.cp-codeBlock__commentAuthor {
  font-weight: 600;
  color: var(--cp-highlight);
}

.cp-codeBlock__commentTime {
  font-size: 10px;
  color: var(--cp-text-light);
}

.cp-codeBlock__commentText {
  color: var(--cp-text);
  white-space: pre-wrap;
  word-break: break-word;
}

.cp-codeBlock__commentDelete {
  margin-top: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--cp-danger);
  font-size: 11px;
  cursor: pointer;
}

/* 评论输入：统一字段 token */
.cp-codeBlock__reviewTextarea {
  width: 100%;
  min-height: 48px;
  padding: var(--cp-field-pad-y) var(--cp-field-pad-x);
  border: 1px solid var(--cp-field-border);
  border-radius: var(--cp-radius-sm);
  background: var(--cp-field-bg);
  color: var(--cp-text);
  font-size: 12px;
  line-height: 1.5;
  resize: vertical;
  outline: none;
  box-shadow: var(--cp-inset);
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease);

  &:hover {
    border-color: var(--cp-field-border-hover);
  }

  &:focus {
    border-color: var(--cp-focus-border);
    box-shadow: var(--cp-focus-ring, var(--cp-ring));
  }
}

.cp-codeBlock__reviewActions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

/* 评论动作：胶囊按钮（发送 = 主操作 highlight） */
.cp-codeBlock__reviewBtn {
  @include cp-pill-button;

  min-height: 26px;
  padding: 0 10px;
  font-size: 11.5px;
}

.cp-codeBlock__reviewBtn--primary {
  @include cp-pill-button(primary);
}
</style>
