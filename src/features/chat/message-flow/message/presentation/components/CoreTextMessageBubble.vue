<script setup lang="ts">
/**
 * @fileoverview CoreTextMessageBubble.vue
 * @description
 * message-flow/message｜Core:Text 消息气泡（支持 `[file:share_key]` token 分段渲染和 inline 编辑）。
 */

import { ref, nextTick, watch, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import FileRefMessageBubble from "./FileRefMessageBubble.vue";
import { hasFileToken, parseCoreTextParts } from "@/features/chat/message-flow/message/domain/coreTextFileSyntax";
import type { MessageMention, MessageReplySummary } from "@/features/chat/message-flow/api-types";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";

type EmojiEntry = { id: string; name: string; filePath: string };
type TextSegment = { type: "text"; value: string } | { type: "emoji"; name: string; imagePath: string };

const customEmojiMap = ref<Map<string, EmojiEntry>>(new Map());

onMounted(async () => {
  try {
    const entries = await invoke<EmojiEntry[]>("list_custom_emojis");
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
   * core-text 原始文本。
   */
  text: string;
  /**
   * 回复预览文本（为空表示不展示）。
   */
  replyText?: string;
  /**
   * 回复引用摘要（含发送者、预览等）。
   */
  reply?: MessageReplySummary;
  /**
   * 消息提及列表。
   */
  mentions?: MessageMention[];
  /**
   * 内联引用回复（quote）。
   */
  quoteReply?: {
    messageId: string;
    userId: string;
    preview: string;
  };
  forwardedFrom?: {
    messageId: string;
    channelId: string;
    userId: string;
    preview: string;
    sentTime: number;
  };
  /**
   * 消息是否已被编辑过（显示 "已编辑" 标记）。
   */
  isEdited?: boolean;
  /**
   * 消息是否属于当前用户。
   */
  isOwn?: boolean;
  /**
   * 外部触发的正在编辑的消息 ID。
   * 当该值与 messageId 相等时进入编辑模式。
   */
  editingMessageId?: string;
  /**
   * 链接预览卡片数据。
   */
  linkPreview?: ChatLinkPreview | null;
}>();

const emit = defineEmits<{
  /**
   * 编辑确认：携带新文本内容。
   */
  (event: "edit", payload: { messageId: string; text: string }): void;
  /**
   * 编辑取消。
   */
  (event: "edit-cancel", messageId: string): void;
  /**
   * 打开图片灯箱。
   */
  (event: "openLightbox", payload: { url: string; fileName: string }): void;
}>();

/**
 * 编辑状态 refs。
 */
const isEditing = ref(false);
const editText = ref("");
const isSaving = ref(false);
const editInputRef = ref<HTMLTextAreaElement | null>(null);

/**
 * 监听外部编辑触发：当 editingMessageId 变为当前消息 id 时进入编辑模式。
 * 当 editingMessageId 变为其他值（或清空）且正在编辑时，退出编辑模式。
 */
watch(() => props.editingMessageId, (newVal) => {
  if (newVal === props.messageId && props.isOwn !== false) {
    startEdit();
  } else if (newVal !== undefined && newVal !== props.messageId && isEditing.value) {
    isEditing.value = false;
    editText.value = "";
    isSaving.value = false;
  }
});

/**
 * 进入编辑模式：填充当前文本，聚焦 textarea 并全选。
 */
function startEdit(): void {
  isEditing.value = true;
  editText.value = props.text;
  isSaving.value = false;
  nextTick(() => {
    editInputRef.value?.focus();
    editInputRef.value?.select();
  });
}

/**
 * 取消编辑：退出编辑模式，清除编辑状态，通知父级。
 */
function cancelEdit(): void {
  isEditing.value = false;
  editText.value = "";
  isSaving.value = false;
  emit("edit-cancel", props.messageId);
}

/**
 * 确认编辑：校验内容变化后发出 edit 事件。
 */
function confirmEdit(): void {
  if (isSaving.value) return;
  const text = editText.value.trim();
  if (!text || text === props.text) {
    cancelEdit();
    return;
  }
  isSaving.value = true;
  emit("edit", { messageId: props.messageId, text });
}

/**
 * 编辑输入框按键处理：
 * - Enter（无 Shift）→ 确认
 * - Esc → 取消
 */
function onEditKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    confirmEdit();
  } else if (e.key === "Escape") {
    e.preventDefault();
    cancelEdit();
  }
}

/**
 * 暴露 startEdit 给父组件，支持通过模板 ref 触发编辑。
 */
defineExpose({ startEdit });

/**
 * 根据提及类型返回对应的 CSS class 名。
 */
function mentionClass(mention: MessageMention): string {
  if (mention.type === "everyone") return "cp-mention--everyone";
  if (mention.type === "here") return "cp-mention--here";
  return "cp-mention--user";
}

function openLink(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}
</script>

<template>
  <!-- 组件：CoreTextMessageBubble｜职责：渲染 core-text（文本 + 文件引用 token），支持 inline 编辑 -->
  <div class="cp-bubble">
    <div v-if="props.forwardedFrom" class="cp-forwardedFrom">
      <span class="cp-forwardedFrom__icon">↩</span>
      <span class="cp-forwardedFrom__text">{{ $t('forwarded_from') }} #{{ props.forwardedFrom.channelId }}</span>
    </div>
    <div v-if="props.quoteReply" class="cp-quoteReply">
      <div class="cp-quoteReply__bar"></div>
      <div class="cp-quoteReply__content">
        <span class="cp-quoteReply__sender">{{ props.quoteReply.userId }}</span>
        <span class="cp-quoteReply__preview">{{ props.quoteReply.preview }}</span>
      </div>
    </div>
    <div v-if="props.reply" class="cp-coreText__reply" :data-unavailable="Boolean(props.reply.unavailable)">
      <div class="cp-coreText__replyAuthor">{{ props.reply.senderName }}</div>
      <div class="cp-coreText__replyPreview">{{ props.reply.unavailable ? 'Original message unavailable' : props.reply.preview }}</div>
    </div>
    <div v-else-if="props.replyText" class="cp-replyMini">
      <div class="cp-replyMini__k">reply</div>
      <div class="cp-replyMini__v">{{ props.replyText }}</div>
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

    <!-- 编辑模式 -->
    <template v-if="isEditing">
      <textarea
        ref="editInputRef"
        v-model="editText"
        class="cp-bubble__editInput"
        :disabled="isSaving"
        @keydown="onEditKeydown"
      ></textarea>
      <div class="cp-bubble__editHint">
        <span v-if="isSaving" class="cp-bubble__editSpinner">...</span>
        <span v-else>Enter 保存 · Esc 取消</span>
      </div>
    </template>
    <!-- 普通渲染模式 -->
    <template v-else>
      <template v-if="hasFileToken(props.text)">
        <template v-for="(p, idx) in parseCoreTextParts(props.text)" :key="`${props.messageId}-${idx}`">
          <span v-if="p.kind === 'text'">
            <template v-for="(seg, si) in parseCustomEmojis(p.text)" :key="`${props.messageId}-${idx}-${si}`">
              <img v-if="seg.type === 'emoji'" :src="seg.imagePath" :alt="`:${seg.name}:`" class="cp-customEmoji" :title="`:${seg.name}:`" />
              <span v-else>{{ seg.value }}</span>
            </template>
          </span>
          <FileRefMessageBubble v-else :filename="p.shareKey" :share-key="p.shareKey" @openLightbox="(payload) => emit('openLightbox', payload)" />
        </template>
      </template>
      <template v-else>
        <template v-for="(seg, si) in parseCustomEmojis(props.text)" :key="`${props.messageId}-text-${si}`">
          <img v-if="seg.type === 'emoji'" :src="seg.imagePath" :alt="`:${seg.name}:`" class="cp-customEmoji" :title="`:${seg.name}:`" />
          <span v-else>{{ seg.value }}</span>
        </template>
      </template>
      <span v-if="props.isEdited" class="cp-bubble__edited">(已编辑)</span>
    </template>

    <div v-if="props.mentions?.length" class="cp-mentionList">
      <span
        v-for="m in props.mentions"
        :key="m.userId"
        class="cp-mentionTag"
        :class="mentionClass(m)"
      >
        @{{ m.displayName }}
      </span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cp-quoteReply {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
  padding: 4px 0;
}
.cp-quoteReply__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-info, #89b4fa);
  flex-shrink: 0;
}
.cp-quoteReply__content {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
}
.cp-quoteReply__sender {
  color: var(--cp-info, #89b4fa);
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
}
.cp-quoteReply__preview {
  color: var(--cp-text-secondary, #a6adc8);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-coreText__reply {
  border-left: 3px solid color-mix(in oklab, var(--cp-info) 55%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 8%, transparent);
  border-radius: 10px;
  padding: 8px 10px;
  margin-bottom: 8px;
}
.cp-coreText__reply[data-unavailable="true"] { opacity: 0.72; }
.cp-coreText__replyAuthor { font-size: 11px; color: var(--cp-text-muted); }
.cp-coreText__replyPreview { margin-top: 4px; font-size: 12px; color: var(--cp-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

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
  color: var(--cp-danger, #e34);
  font-weight: 700;
  background: color-mix(in oklab, var(--cp-danger) 10%, transparent);
}
.cp-mention--here {
  color: var(--cp-warning);
  font-weight: 600;
  background: color-mix(in oklab, var(--cp-warning) 10%, transparent);
}
.cp-forwardedFrom {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--cp-text-muted, #a6adc8);
}
.cp-forwardedFrom__icon {
  flex-shrink: 0;
}
.cp-forwardedFrom__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 编辑输入框 */
.cp-bubble__editInput {
  width: 100%;
  min-height: 48px;
  padding: 8px 12px;
  border: 1px solid var(--cp-accent, #5865f2);
  border-radius: 6px;
  background: var(--cp-panel);
  color: var(--cp-text);
  font-size: 13px;
  resize: vertical;
  outline: none;
}
.cp-bubble__editHint {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--cp-text-muted, #888);
  margin-top: 4px;
}
.cp-bubble__editSpinner {
  color: var(--cp-accent, #5865f2);
}
.cp-bubble__edited {
  font-size: 11px;
  color: var(--cp-text-muted, #888);
  margin-left: 6px;
}

/* 链接预览卡片 */
.cp-linkPreviewInMsg {
  margin-top: 6px;
  border: 1px solid var(--cp-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--cp-panel-muted);
  cursor: pointer;
  max-width: 360px;
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
  border-radius: 6px;
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

