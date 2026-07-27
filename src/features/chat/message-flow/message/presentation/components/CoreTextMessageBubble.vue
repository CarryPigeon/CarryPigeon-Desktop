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
import type { MessageMention, MessageReplySummary } from "@/features/chat/message-flow/api-types";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";

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
}>();

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
  <!-- 组件：CoreTextMessageBubble｜职责：渲染 core-text（文本 + 文件引用 token） -->
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
