<script setup lang="ts">
/**
 * @fileoverview CoreTextMessageBubble.vue
 * @description
 * message-flow/message｜Core:Text 消息气泡（支持 `[file:share_key]` token 分段渲染）。
 */

import { computed, ref, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { TAURI_COMMANDS } from "@/shared/tauri/commands";
import FileRefMessageBubble from "./FileRefMessageBubble.vue";
import CodeBlockReviewable from "@/features/chat/message-flow/code-review/presentation/CodeBlockReviewable.vue";
import { hasFileToken, parseCoreTextParts } from "@/features/chat/message-flow/message/domain/coreTextFileSyntax";
import { parseCoreTextWithCodeBlocks } from "@/features/chat/message-flow/code-review/domain/codeBlockParser";
import type { MessageMention, MessageQuoteSummary, MessageReplySummary } from "@/features/chat/message-flow/api-types";
import type { ForwardedMessageEntry } from "@/features/chat/message-flow/message/domain/messageModels";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";
import AppIcon from "@/shared/ui/AppIcon.vue";

type EmojiEntry = { id: string; name: string; filePath: string };
type TextSegment = { type: "text"; value: string } | { type: "emoji"; name: string; imagePath: string };

const customEmojiMap = ref<Map<string, EmojiEntry>>(new Map());

onMounted(async () => {
  try {
    const entries = await invoke<EmojiEntry[]>(TAURI_COMMANDS.listCustomEmojis);
    const map = new Map<string, EmojiEntry>();
    for (const e of entries) {
      map.set(e.name, e);
    }
    customEmojiMap.value = map;
  } catch { /* ignore */ }
});

function parseCustomEmojis(text: string): TextSegment[] {
  const map = customEmojiMap.value;
  if (map.size === 0) return [{ type: "text", value: text }];

  const segments: TextSegment[] = [];
  const re = /:([a-zA-Z0-9_]+):/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    if (match.index > lastIdx) {
      segments.push({ type: "text", value: text.slice(lastIdx, match.index) });
    }
    if (map.has(name)) {
      const entry = map.get(name)!;
      segments.push({ type: "emoji", name, imagePath: `asset://localhost/${encodeURIComponent(entry.filePath)}` });
    } else {
      segments.push({ type: "text", value: match[0] });
    }
    lastIdx = re.lastIndex;
  }

  if (lastIdx < text.length) {
    segments.push({ type: "text", value: text.slice(lastIdx) });
  }

  return segments;
}

const props = defineProps<{
  /**
   * 消息 id（用于分段 key）。
   */
  messageId: string;
  /**
   * 所属频道 id（用于代码审查注释分区）。
   */
  channelId?: string;
  /**
   * core-text 原始文本。
   */
  text: string;
  /**
   * 当前用户 id（用于代码审查注释作者）。
   */
  currentUserId?: string;
  /**
   * 当前用户显示名（用于代码审查注释展示）。
   */
  currentUserName?: string;
  /**
   * 回复预览文本（为空表示不展示）。
   */
  replyText?: string;
  /**
   * 回复引用摘要（含发送者、预览等）。
   */
  reply?: MessageReplySummary;
  /**
   * 被回复消息 id（reply 摘要缺失时的兜底定位依据）。
   */
  replyToId?: string;
  /**
   * 消息提及列表。
   */
  mentions?: MessageMention[];
  /**
   * 内联引用回复（quote）。
   */
  quoteReply?: MessageQuoteSummary;
  /**
   * 转发来源快照（单条转发）：展示原消息预览，可跳转到源频道的原消息。
   */
  forwardedFrom?: ForwardedMessageEntry;
  /**
   * 消息是否已被编辑过（显示 "已编辑" 标记）。
   */
  isEdited?: boolean;
  /**
   * 消息是否属于当前用户。
   */
  isOwn?: boolean;
  /**
   * 链接预览卡片数据。
   */
  linkPreview?: ChatLinkPreview | null;
}>()

/**
 * 把文本拆分为普通文本段与 fenced code block 段，便于分别渲染可评论代码块。
 */
const renderSegments = computed(() => {
  let codeCount = 0;
  return parseCoreTextWithCodeBlocks(props.text).map((seg) => {
    if (seg.kind === "code") {
      return { ...seg, blockIndex: codeCount++ };
    }
    return seg;
  });
});;

const emit = defineEmits<{
  /**
   * 打开图片灯箱。
   */
  (event: "openLightbox", payload: { url: string; fileName: string }): void;
  /**
   * 右键消息引用块：请求打开「跳转到被回复消息」菜单。
   *
   * payload.channelId 存在时表示跳转目标在其他频道（如转发来源），
   * 由页面层负责先切换频道再定位。
   */
  (event: "openReferenceMenu", payload: { event: MouseEvent; messageId: string; channelId?: string }): void;
  /**
   * 点击引用块上的「跳转到原消息」按钮。
   *
   * channelId 存在时表示目标消息在其他频道（跨频道转发跳转）。
   */
  (event: "jumpReference", messageId: string, channelId?: string): void;
}>();

/**
 * 回复引用的目标消息 id：优先取 reply 摘要，缺失时回退 `replyToId`。
 *
 * 说明：原消息不可用（已删除 / 撤回）时返回空串，表示不可跳转。
 */
const replyReferenceId = computed(() => {
  if (props.reply) {
    if (props.reply.unavailable) return "";
    return String(props.reply.messageId ?? "").trim();
  }
  return String(props.replyToId ?? "").trim();
});

/**
 * 内联引用（quote）的目标消息 id；缺失表示不可跳转。
 */
const quoteReferenceId = computed(() => String(props.quoteReply?.messageId ?? "").trim());

/**
 * 转发来源的目标消息 id；缺失表示不可跳转（快照无 mid，如源消息已不可解析）。
 */
const forwardSourceReferenceId = computed(() => String(props.forwardedFrom?.messageId ?? "").trim());

/**
 * 转发来源的源频道 id：与当前频道不同时跳转为跨频道定位。
 */
const forwardSourceChannelId = computed(() => String(props.forwardedFrom?.channelId ?? "").trim());

/**
 * 右键引用块：派发「跳转到被回复消息」菜单请求。
 *
 * 说明：仅在存在可跳转目标时拦截事件；否则不拦截，让消息行的右键菜单照常打开。
 *
 * @param e - 鼠标右键事件。
 * @param messageId - 被引用的消息 id。
 * @param channelId - 跳转目标所在频道（跨频道转发来源时提供）。
 * @returns 无返回值。
 */
function handleReferenceContextMenu(e: MouseEvent, messageId: string, channelId?: string): void {
  const mid = String(messageId ?? "").trim();
  if (!mid) return;
  e.preventDefault();
  e.stopPropagation();
  emit("openReferenceMenu", { event: e, messageId: mid, channelId: channelId?.trim() || undefined });
}

/**
 * 回复引用块右键处理。
 *
 * @param e - 鼠标右键事件。
 * @returns 无返回值。
 */
function handleReplyReferenceContextMenu(e: MouseEvent): void {
  handleReferenceContextMenu(e, replyReferenceId.value);
}

/**
 * 内联引用块右键处理。
 *
 * @param e - 鼠标右键事件。
 * @returns 无返回值。
 */
function handleQuoteReferenceContextMenu(e: MouseEvent): void {
  handleReferenceContextMenu(e, quoteReferenceId.value);
}

/**
 * 点击引用块上的「跳转到原消息」按钮。
 *
 * @param e - 鼠标点击事件。
 * @param messageId - 被引用的消息 id。
 * @param channelId - 跳转目标所在频道（跨频道转发来源时提供）。
 * @returns 无返回值。
 */
function handleJumpReference(e: MouseEvent, messageId: string, channelId?: string): void {
  const mid = String(messageId ?? "").trim();
  if (!mid) return;
  // 阻止冒泡：避免点击按钮被当作「点击消息行」处理。
  e.stopPropagation();
  emit("jumpReference", mid, channelId?.trim() || undefined);
}

/**
 * 点击转发来源块：跳转到源频道的原消息。
 *
 * @param e - 鼠标点击事件。
 * @returns 无返回值。
 */
function handleJumpForwardSource(e: MouseEvent): void {
  const mid = forwardSourceReferenceId.value;
  if (!mid) return;
  // 阻止冒泡：避免点击被当作「点击消息行」处理。
  e.stopPropagation();
  emit("jumpReference", mid, forwardSourceChannelId.value || undefined);
}

/**
 * 右键转发来源块：派发「跳转到转发的原消息」菜单请求。
 *
 * @param e - 鼠标右键事件。
 * @returns 无返回值。
 */
function handleForwardSourceContextMenu(e: MouseEvent): void {
  const mid = forwardSourceReferenceId.value;
  if (!mid) return;
  e.preventDefault();
  e.stopPropagation();
  emit("openReferenceMenu", { event: e, messageId: mid, channelId: forwardSourceChannelId.value || undefined });
}

/**
 * 根据提及类型返回对应的 CSS class 名。
 */
function mentionClass(mention: MessageMention): string {
  if (mention.type === "everyone") return "cp-mention--everyone";
  if (mention.type === "here") return "cp-mention--here";
  return "cp-mention--user";
}

function openLink(url: string): void {
  // 安全约束：链接预览 URL 来自服务端消息数据（可能被恶意构造），
  // 仅允许 http/https，拒绝 file:/自定义协议等任意 scheme。
  const trimmed = String(url ?? "").trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return;
  }
  window.open(parsed.toString(), "_blank", "noopener,noreferrer");
}
</script>

<template>
  <!-- 组件：CoreTextMessageBubble｜职责：渲染 core-text（文本 + 文件引用 token） -->
  <div class="cp-bubble">
    <!-- 区块：转发来源（forwardedFrom 快照）——展示原消息预览，可跳转到源频道原消息 -->
    <div
      v-if="props.forwardedFrom"
      class="cp-forwardedFrom"
      :class="{ 'cp-forwardedFrom--jumpable': Boolean(forwardSourceReferenceId) }"
      :title="forwardSourceReferenceId ? $t('jump_to_forwarded_message') : undefined"
      @click="handleJumpForwardSource"
      @contextmenu="handleForwardSourceContextMenu"
    >
      <div class="cp-forwardedFrom__bar"></div>
      <div class="cp-forwardedFrom__content">
        <span class="cp-forwardedFrom__meta">
          <AppIcon name="corner-up-left" :size="12" />
          <span class="cp-forwardedFrom__label">
            {{ $t('forwarded_from') }} #{{ props.forwardedFrom.channelName || props.forwardedFrom.channelId }}
          </span>
          <span class="cp-forwardedFrom__author">{{ props.forwardedFrom.authorName || props.forwardedFrom.userId }}</span>
        </span>
        <span v-if="props.forwardedFrom.preview" class="cp-forwardedFrom__preview">{{ props.forwardedFrom.preview }}</span>
      </div>
      <button
        v-if="forwardSourceReferenceId"
        class="cp-jumpRef"
        type="button"
        :title="$t('jump_to_forwarded_message')"
        :aria-label="$t('jump_to_forwarded_message')"
        @click="handleJumpReference($event, forwardSourceReferenceId, forwardSourceChannelId)"
      >
        <AppIcon name="rollback" :size="14" />
      </button>
    </div>
    <!-- 区块：内联引用（quote）——可跳转到被引用消息 -->
    <div
      v-if="props.quoteReply"
      class="cp-quoteReply"
      :class="{ 'cp-quoteReply--jumpable': Boolean(quoteReferenceId) }"
      @contextmenu="handleQuoteReferenceContextMenu"
    >
      <div class="cp-quoteReply__bar"></div>
      <div class="cp-quoteReply__content">
        <span class="cp-quoteReply__sender">{{ props.quoteReply.senderName || props.quoteReply.userId }}</span>
        <span class="cp-quoteReply__preview">{{ props.quoteReply.preview }}</span>
      </div>
      <button
        v-if="quoteReferenceId"
        class="cp-jumpRef"
        type="button"
        :title="$t('jump_to_referenced_message')"
        :aria-label="$t('jump_to_referenced_message')"
        @click="handleJumpReference($event, quoteReferenceId)"
      >
        <AppIcon name="rollback" :size="14" />
      </button>
    </div>
    <!-- 区块：回复引用（reply 摘要）——可跳转到被回复消息 -->
    <div
      v-if="props.reply"
      class="cp-coreText__reply"
      :data-unavailable="Boolean(props.reply.unavailable)"
      :class="{ 'cp-coreText__reply--jumpable': Boolean(replyReferenceId) }"
      @contextmenu="handleReplyReferenceContextMenu"
    >
      <div class="cp-coreText__replyBody">
        <div class="cp-coreText__replyAuthor">{{ props.reply.senderName }}</div>
        <div class="cp-coreText__replyPreview">{{ props.reply.unavailable ? 'Original message unavailable' : props.reply.preview }}</div>
      </div>
      <button
        v-if="replyReferenceId"
        class="cp-jumpRef"
        type="button"
        :title="$t('jump_to_referenced_message')"
        :aria-label="$t('jump_to_referenced_message')"
        @click="handleJumpReference($event, replyReferenceId)"
      >
        <AppIcon name="rollback" :size="14" />
      </button>
    </div>
    <!-- 区块：回复引用（仅有 replyToId 时的迷你预览）——可跳转到被回复消息 -->
    <div
      v-else-if="props.replyText"
      class="cp-replyMini"
      :class="{ 'cp-replyMini--jumpable': Boolean(replyReferenceId) }"
      @contextmenu="handleReplyReferenceContextMenu"
    >
      <div class="cp-replyMini__k">reply</div>
      <div class="cp-replyMini__v">{{ props.replyText }}</div>
      <button
        v-if="replyReferenceId"
        class="cp-jumpRef"
        type="button"
        :title="$t('jump_to_referenced_message')"
        :aria-label="$t('jump_to_referenced_message')"
        @click="handleJumpReference($event, replyReferenceId)"
      >
        <AppIcon name="rollback" :size="14" />
      </button>
    </div>

    <!-- 链接预览 -->
    <div v-if="linkPreview" class="cp-linkPreviewInMsg" @click="openLink(linkPreview.url)">
      <div class="cp-linkPreviewInMsg__body">
        <div class="cp-linkPreviewInMsg__text">
          <div v-if="linkPreview.siteName || linkPreview.faviconUrl" class="cp-linkPreviewInMsg__site">
            <img v-if="linkPreview.faviconUrl" :src="linkPreview.faviconUrl" class="cp-linkPreviewInMsg__favicon" alt="" referrerpolicy="no-referrer" />
            <span>{{ linkPreview.siteName }}</span>
          </div>
          <div v-if="linkPreview.title" class="cp-linkPreviewInMsg__title">{{ linkPreview.title }}</div>
          <div v-if="linkPreview.description" class="cp-linkPreviewInMsg__desc">{{ linkPreview.description }}</div>
        </div>
        <img v-if="linkPreview.imageUrl" :src="linkPreview.imageUrl" class="cp-linkPreviewInMsg__thumb" alt="" referrerpolicy="no-referrer" />
      </div>
    </div>

    <template v-for="(segment, segIdx) in renderSegments" :key="`${props.messageId}-seg-${segIdx}`">
      <template v-if="segment.kind === 'text'">
        <template v-if="hasFileToken(segment.text)">
          <template v-for="(p, idx) in parseCoreTextParts(segment.text)" :key="`${props.messageId}-${segIdx}-${idx}`">
            <span v-if="p.kind === 'text'">
              <template v-for="(seg, si) in parseCustomEmojis(p.text)" :key="`${props.messageId}-${segIdx}-${idx}-${si}`">
                <img v-if="seg.type === 'emoji'" :src="seg.imagePath" :alt="':' + seg.name + ':'" class="cp-customEmoji" :title="':' + seg.name + ':'" />
                <span v-else>{{ seg.value }}</span>
              </template>
            </span>
            <FileRefMessageBubble v-else :filename="p.shareKey" :share-key="p.shareKey" @openLightbox="(payload) => emit('openLightbox', payload)" />
          </template>
        </template>
        <template v-else>
          <template v-for="(seg, si) in parseCustomEmojis(segment.text)" :key="`${props.messageId}-${segIdx}-text-${si}`">
            <img v-if="seg.type === 'emoji'" :src="seg.imagePath" :alt="':' + seg.name + ':'" class="cp-customEmoji" :title="':' + seg.name + ':'" />
            <span v-else>{{ seg.value }}</span>
          </template>
        </template>
      </template>
      <CodeBlockReviewable
        v-else
        :code="segment.code"
        :language="segment.language"
        :block-index="segment.blockIndex ?? 0"
        :message-id="props.messageId"
        :channel-id="props.channelId ?? ''"
        :current-user-id="props.currentUserId ?? ''"
        :current-user-name="props.currentUserName ?? ''"
      />
    </template>
    <span v-if="props.isEdited" class="cp-bubble__edited">(已编辑)</span>

    <div v-if="props.mentions?.length" class="cp-mentionList">
      <span
        v-for="m in props.mentions"
        :key="m.userId"
        class="cp-mentionTag"
        :class="mentionClass(m)"
      >
        @{{ m.displayName || m.userId }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
/* 样式：CoreTextMessageBubble｜规格：引用块/链接卡统一圆角与 token，domain 色条与布局不变 */
.cp-quoteReply {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  padding: 4px 0;
  border-radius: var(--cp-radius-sm);
  min-width: 0;
}
/* 可跳转提示：右键菜单中的「跳转到被回复的消息」。 */
.cp-quoteReply--jumpable {
  cursor: context-menu;
}
.cp-quoteReply--jumpable:hover {
  background: color-mix(in oklab, var(--cp-info) 10%, transparent);
}
.cp-quoteReply__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-info);
  flex-shrink: 0;
}
.cp-quoteReply__content {
  display: flex;
  flex: 1 1 auto;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.cp-quoteReply__sender {
  color: var(--cp-info);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}
.cp-quoteReply__preview {
  color: var(--cp-text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  /* flex 子项默认 min-width: auto：不显式归零则拒绝收缩到内容宽度以下，
     text-overflow: ellipsis 永不触发，卡片会把消息行撑破（面板压窄时被裁切）。 */
  flex: 0 1 auto;
  min-width: 0;
}
.cp-coreText__reply {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  border-left: 3px solid color-mix(in oklab, var(--cp-info) 55%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 8%, transparent);
  border-radius: var(--cp-radius-control);
  padding: 8px 10px;
  margin-bottom: 8px;
  min-width: 0;
}
.cp-coreText__reply[data-unavailable="true"] { opacity: 0.72; }
/* 可跳转提示：右键打开「跳转到被回复的消息」菜单。 */
.cp-coreText__reply--jumpable {
  cursor: context-menu;
}
.cp-coreText__reply--jumpable:hover {
  background: color-mix(in oklab, var(--cp-info) 16%, transparent);
  border-left-color: var(--cp-info);
}
/* 引用块文本列：需要 min-width 才能让长预览正确省略号截断。 */
.cp-coreText__replyBody {
  flex: 1 1 auto;
  min-width: 0;
}
.cp-coreText__replyAuthor { font-size: 11px; color: var(--cp-text-muted); }
.cp-coreText__replyPreview { margin-top: 4px; font-size: 12px; color: var(--cp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 引用块「跳转到原消息」按钮：幽灵按钮（透明底 + 悬停显形），靠右常驻。 */
.cp-jumpRef {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: auto;
  padding: 2px 6px;
  border: 1px solid transparent;
  border-radius: var(--cp-radius-sm);
  background: transparent;
  color: color-mix(in oklab, var(--cp-info) 72%, var(--cp-text-muted));
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}
.cp-jumpRef:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
}
.cp-jumpRef:focus-visible {
  outline: 2px solid var(--cp-highlight-border-strong);
  outline-offset: 1px;
}
/* 单行引用条（quote / 迷你回复）内按行高垂直居中。 */
.cp-quoteReply .cp-jumpRef,
.cp-replyMini .cp-jumpRef {
  align-self: center;
}

/* 可跳转提示：仅有 replyToId 的迷你引用同样支持右键跳转。 */
.cp-replyMini--jumpable {
  cursor: context-menu;
}
.cp-replyMini--jumpable:hover {
  border-color: color-mix(in oklab, var(--cp-info) 45%, var(--cp-border-light));
}

.cp-mentionList {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.cp-mentionTag {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  line-height: 1.4;
}
.cp-mention--user {
  background: color-mix(in oklab, var(--cp-info) 14%, transparent);
  color: color-mix(in oklab, var(--cp-info) 70%, var(--cp-text));
}
.cp-mention--everyone {
  color: var(--cp-danger);
  font-weight: 700;
  background: var(--cp-danger-bg);
}
.cp-mention--here {
  color: var(--cp-warn);
  font-weight: 600;
  background: var(--cp-warn-bg);
}
/* 转发来源块：与引用块同规格（左侧色条 + 来源 meta + 原消息预览），可跳转到源频道原消息。 */
.cp-forwardedFrom {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  padding: 4px 0;
  border-radius: var(--cp-radius-sm);
  min-width: 0;
  max-width: 360px;
}
.cp-forwardedFrom--jumpable {
  cursor: pointer;
}
.cp-forwardedFrom--jumpable:hover {
  background: color-mix(in oklab, var(--cp-info) 10%, transparent);
}
.cp-forwardedFrom__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-info);
  flex-shrink: 0;
}
.cp-forwardedFrom__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}
.cp-forwardedFrom__meta {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--cp-info);
  min-width: 0;
}
.cp-forwardedFrom__label {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-forwardedFrom__author {
  font-size: 11px;
  color: var(--cp-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-forwardedFrom__preview {
  font-size: 12px;
  color: var(--cp-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 转发来源块内跳转按钮与单行引用条一致垂直居中。 */
.cp-forwardedFrom .cp-jumpRef {
  align-self: center;
}

.cp-bubble__edited {
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-left: 6px;
}

/* 链接预览卡片 */
.cp-linkPreviewInMsg {
  margin-top: 6px;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-control);
  padding: 10px;
  background: var(--cp-panel-muted);
  cursor: pointer;
  max-width: 360px;
  transition: border-color var(--cp-fast) var(--cp-ease);

  &:hover {
    border-color: var(--cp-highlight-border);
  }
}
.cp-linkPreviewInMsg__body {
  display: flex;
  gap: 8px;
}
.cp-linkPreviewInMsg__text {
  flex: 1;
  min-width: 0;
}
.cp-linkPreviewInMsg__site {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-bottom: 4px;
}
.cp-linkPreviewInMsg__favicon { border-radius: 2px; flex-shrink: 0; }
.cp-linkPreviewInMsg__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-linkPreviewInMsg__desc {
  font-size: 11px;
  color: var(--cp-text-muted);
  margin-top: 3px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.cp-linkPreviewInMsg__thumb {
  width: 60px;
  height: 60px;
  border-radius: var(--cp-radius-sm);
  object-fit: cover;
  flex-shrink: 0;
}

.cp-customEmoji {
  width: 1.4em;
  height: 1.4em;
  vertical-align: text-bottom;
  display: inline-block;
  object-fit: contain;
}
</style>
