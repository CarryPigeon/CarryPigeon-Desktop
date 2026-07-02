/**
 * @fileoverview code-review｜storage｜本地注释存储。
 * @description
 * 使用 localStorage 按频道+消息维度存储代码审查注释。
 * v0.4.0 为本地-only MVP，后续可迁移到 chat_cache 或服务端线程回复。
 */

import type { CodeReviewComment } from "@/features/chat/message-flow/code-review/domain/codeReviewModels";

const STORAGE_KEY_PREFIX = "cp:codeReview:";

function buildKey(channelId: string, messageId: string): string {
  return `${STORAGE_KEY_PREFIX}${channelId}:${messageId}`;
}

export function loadCodeReviewComments(channelId: string, messageId: string): CodeReviewComment[] {
  if (!channelId || !messageId) return [];
  try {
    const raw = localStorage.getItem(buildKey(channelId, messageId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CodeReviewComment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCodeReviewComments(
  channelId: string,
  messageId: string,
  comments: CodeReviewComment[],
): void {
  if (!channelId || !messageId) return;
  try {
    localStorage.setItem(buildKey(channelId, messageId), JSON.stringify(comments));
  } catch {
    // localStorage 可能已满或不可用，静默失败。
  }
}

export function deleteCodeReviewComment(
  channelId: string,
  messageId: string,
  commentId: string,
): void {
  const comments = loadCodeReviewComments(channelId, messageId);
  const filtered = comments.filter((c) => c.commentId !== commentId);
  if (filtered.length !== comments.length) {
    saveCodeReviewComments(channelId, messageId, filtered);
  }
}
