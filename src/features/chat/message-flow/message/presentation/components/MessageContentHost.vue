<script setup lang="ts">
/**
 * @fileoverview MessageContentHost.vue
 * @description
 * message-flow/message｜消息内容渲染宿主：
 * - 接收统一消息输入；
 * - 通过 resolver 产出渲染模型；
 * - 执行 core/plugin/unknown 的最终渲染分发。
 */

import { computed } from "vue";
import { useI18n } from "vue-i18n";
import UnknownDomainCard from "./UnknownDomainCard.vue";
import VoiceMessageBubble from "./VoiceMessageBubble.vue";
import {
  resolveMessageRenderModel,
  type MessageRendererRegistry,
} from "@/features/chat/message-flow/message/domain/messageRendererResolver";
import type { RenderableChatMessage } from "@/features/chat/message-flow/message/domain/messageModels";
import CoreTextMessageBubble from "./CoreTextMessageBubble.vue";
import MergedForwardBubble from "./MergedForwardBubble.vue";
import ReactionBar from "./ReactionBar.vue";
import { currentChatUserId } from "@/features/chat/composition/chatAccountSession";

const props = defineProps<{
  /**
   * 原始聊天消息。
   */
  message: RenderableChatMessage;
  /**
   * 回复预览文本（仅 core-text 使用）。
   */
  replyText?: string;
  /**
   * domain registry（来自父级 store）。
   */
  domainRegistryStore: unknown;
  /**
   * 外部触发的正在编辑的消息 ID。
   */
  editingMessageId?: string;
}>();

const emit = defineEmits<{
  /**
   * 未知 domain 场景下触发安装提示。
   */
  (event: "install", pluginId: string | undefined): void;
  /**
   * 消息回应切换。
   */
  (event: "react", messageId: string, emoji: string): void;
  /**
   * 编辑确认。
   */
  (event: "edit", payload: { messageId: string; text: string }): void;
  /**
   * 编辑取消。
   */
  (event: "edit-cancel", messageId: string): void;
  /**
   * 打开图片灯箱。
   */
  (event: "openLightbox", payload: { url: string; filename: string }): void;
  /**
   * 打开线程面板。
   */
  (event: "viewThread", messageId: string): void;
  /**
   * 查看合并转发消息详情。
   */
  (event: "viewForwardDetail", payload: { fromName: string; forwardedMessages: Array<{ messageId: string; channelId: string; userId: string; preview: string; sentTime: number }>; comment?: string }): void;
}>();

const { t } = useI18n();

const registry = computed<MessageRendererRegistry>(() => props.domainRegistryStore as MessageRendererRegistry);

const renderModel = computed(() =>
  resolveMessageRenderModel(props.message, String(props.replyText ?? ""), registry.value),
);

/**
 * 判断消息是否属于当前登录用户。
 */
const isOwn = computed(() => props.message.from.id === currentChatUserId.value);

/**
 * 消息是否已被编辑过（通过 editedAt 时间戳判断）。
 */
const isEdited = computed(() => {
  const msg = props.message as { editedAt?: number };
  return msg.editedAt != null && msg.editedAt > 0;
});

/**
 * 判断消息是否已被撤回。
 */
const isRecalled = computed(() => {
  const msg = props.message as { recalledAt?: number };
  return msg.recalledAt != null && msg.recalledAt > 0;
});

const isMergedForward = computed(() => {
  const fms = (props.message as { forwardedMessages?: unknown[] }).forwardedMessages;
  return Array.isArray(fms) && fms.length > 0;
});

const mergedForwardData = computed(() => {
  if (!isMergedForward.value) return null;
  return {
    fromName: props.message.from.name,
    forwardedMessages: (props.message as { forwardedMessages?: Array<{ messageId: string; channelId: string; userId: string; preview: string; sentTime: number }> }).forwardedMessages!,
    comment: props.message.kind === "core_text" ? props.message.text : undefined,
  };
});

/**
 * 线程回复计数。
 */
const threadReplyCount = computed(() => {
  const msg = props.message as { threadReplyCount?: number };
  return msg.threadReplyCount ?? 0;
});

/**
 * 判断当前消息是否为 Voice:Message 语音消息。
 */
const isVoiceMessage = computed(() => {
  return props.message.domain.id === "Voice:Message";
});

/**
 * 语音消息数据（从 message.data 中提取）。
 */
const voiceMessageData = computed<{ shareKey?: string; durationMs?: number } | null>(() => {
  if (!isVoiceMessage.value) return null;
  const data = (props.message as { data?: Record<string, unknown> }).data;
  if (!data) return null;
  return {
    shareKey: String(data.shareKey ?? ""),
    durationMs: Number(data.durationMs ?? 0),
  };
});

/**
 * 处理未知 domain 卡片的安装回调。
 *
 * @returns 无返回值。
 */
function handleInstall(): void {
  if (renderModel.value.kind !== "unknown") return;
  emit("install", renderModel.value.pluginIdHint);
}
</script>

<template>
  <!-- 组件：MessageContentHost｜职责：统一消息内容渲染入口 -->
  <template v-if="isRecalled">
    <div class="cp-recalledBubble">
      <span class="cp-recalledBubble__text">{{ props.message.from.name }} {{ t('recalled_a_message') }}</span>
    </div>
  </template>
  <template v-else>
    <!-- 语音消息（Voice:Message） -->
    <VoiceMessageBubble
      v-if="isVoiceMessage && voiceMessageData && voiceMessageData.shareKey"
      :share-key="voiceMessageData.shareKey"
      :duration-ms="voiceMessageData.durationMs ?? 0"
    />
    <MergedForwardBubble
      v-else-if="isMergedForward && mergedForwardData"
      :message-id="props.message.id"
      :from-name="mergedForwardData.fromName"
      :forwarded-messages="mergedForwardData.forwardedMessages"
      :comment="mergedForwardData.comment"
      @viewDetail="emit('viewForwardDetail', { fromName: mergedForwardData.fromName, forwardedMessages: mergedForwardData.forwardedMessages, comment: mergedForwardData.comment })"
    />
    <CoreTextMessageBubble
      v-else-if="renderModel.kind === 'core'"
      :message-id="renderModel.messageId"
      :text="renderModel.text"
      :reply-text="renderModel.replyText"
      :reply="props.message.kind === 'core_text' ? props.message.replyTo : undefined"
      :mentions="props.message.kind === 'core_text' ? props.message.mentions : undefined"
      :quote-reply="props.message.kind === 'core_text' ? props.message.quoteReply : undefined"
      :forwarded-from="props.message.kind === 'core_text' ? props.message.forwardedFrom : undefined"
      :is-edited="isEdited"
      :is-own="isOwn"
      :editing-message-id="props.editingMessageId"
      :link-preview="(props.message as any).linkPreview ?? null"
      @edit="(payload) => emit('edit', payload)"
      @edit-cancel="(messageId) => emit('edit-cancel', messageId)"
      @openLightbox="(payload) => emit('openLightbox', payload)"
    />
    <div v-else-if="renderModel.kind === 'plugin'" class="cp-pluginBubble">
      <component
        :is="renderModel.renderer"
        :context="renderModel.context"
        :data="renderModel.data"
        :preview="renderModel.preview"
        :domain="renderModel.domainId"
        :domainVersion="renderModel.domainVersion"
        :mid="renderModel.messageId"
        :from="renderModel.from"
        :timeMs="renderModel.timeMs"
        :replyToMid="renderModel.replyToMid"
      />
    </div>
    <UnknownDomainCard
      v-else
      :domain-id="renderModel.domainId"
      :domain-version="renderModel.domainVersion"
      :plugin-id-hint="renderModel.pluginIdHint || ''"
      :preview="renderModel.preview"
      @install="handleInstall"
    />
    <ReactionBar
      :message-id="props.message.id"
      :reactions="props.message.reactions ?? []"
      @react="(messageId, emoji) => emit('react', messageId, emoji)"
    />
    <button
      v-if="threadReplyCount > 0"
      class="cp-threadLink"
      @click="emit('viewThread', props.message.id)"
    >
      {{ threadReplyCount }} {{ threadReplyCount === 1 ? t('reply') : t('replies') }} &mdash; {{ t('view_thread') }}
    </button>
  </template>
</template>

<style scoped>
.cp-recalledBubble {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  color: var(--cp-text-muted);
  font-style: italic;
  font-size: 12px;
  user-select: none;
}

.cp-threadLink {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--cp-accent, #5865f2);
  font-size: 11px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-threadLink:hover {
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 10%, transparent);
}
</style>
