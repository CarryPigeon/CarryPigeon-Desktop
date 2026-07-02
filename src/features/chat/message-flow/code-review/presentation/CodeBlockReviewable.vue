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
.cp-codeBlock {
  background: var(--cp-panel, #1e1e2e);
  border: 1px solid var(--cp-border, #313244);
  border-radius: 8px;
  margin: 6px 0;
  overflow: hidden;
  font-family: ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
}

.cp-codeBlock__lang {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--cp-text-muted, #a6adc8);
  background: var(--cp-panel-muted, #181825);
  border-bottom: 1px solid var(--cp-border, #313244);
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
  transition: background-color 0.1s ease;
}

.cp-codeBlock__line:hover {
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 8%, transparent);
}

.cp-codeBlock__line--active {
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 14%, transparent);
}

.cp-codeBlock__lineNumber {
  text-align: right;
  padding: 0 10px;
  color: var(--cp-text-muted, #6c7086);
  user-select: none;
}

.cp-codeBlock__lineContent {
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--cp-text, #cdd6f4);
}

.cp-codeBlock__commentBadge {
  align-self: center;
  min-width: 16px;
  height: 16px;
  margin-left: 8px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--cp-accent, #5865f2);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
}

.cp-codeBlock__comments,
.cp-codeBlock__reviewInput {
  grid-column: 1 / -1;
  margin: 4px 10px 8px 46px;
  padding: 8px;
  border-radius: 6px;
  background: var(--cp-panel-muted, #181825);
  border: 1px solid var(--cp-border, #313244);
}

.cp-codeBlock__comment + .cp-codeBlock__comment {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--cp-border, #313244);
}

.cp-codeBlock__commentMeta {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.cp-codeBlock__commentAuthor {
  font-weight: 600;
  color: var(--cp-accent, #89b4fa);
}

.cp-codeBlock__commentTime {
  font-size: 10px;
  color: var(--cp-text-muted, #6c7086);
}

.cp-codeBlock__commentText {
  color: var(--cp-text, #cdd6f4);
  white-space: pre-wrap;
  word-break: break-word;
}

.cp-codeBlock__commentDelete {
  margin-top: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--cp-danger, #f38ba8);
  font-size: 11px;
  cursor: pointer;
}

.cp-codeBlock__reviewTextarea {
  width: 100%;
  min-height: 48px;
  padding: 6px 8px;
  border: 1px solid var(--cp-border, #313244);
  border-radius: 4px;
  background: var(--cp-panel, #1e1e2e);
  color: var(--cp-text, #cdd6f4);
  font-size: 12px;
  resize: vertical;
  outline: none;
}

.cp-codeBlock__reviewActions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.cp-codeBlock__reviewBtn {
  padding: 4px 10px;
  border: 1px solid var(--cp-border, #313244);
  border-radius: 4px;
  background: var(--cp-panel, #1e1e2e);
  color: var(--cp-text, #cdd6f4);
  font-size: 12px;
  cursor: pointer;
}

.cp-codeBlock__reviewBtn--primary {
  background: var(--cp-accent, #5865f2);
  border-color: var(--cp-accent, #5865f2);
  color: #fff;
}
</style>
