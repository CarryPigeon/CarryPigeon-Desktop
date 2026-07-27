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
import AppIcon from "@/shared/ui/AppIcon.vue";
import UnknownDomainCard from "./UnknownDomainCard.vue";
import ImageMessageBubble from "./ImageMessageBubble.vue";
import VideoMessageBubble from "./VideoMessageBubble.vue";
import VoiceMessageBubble from "./VoiceMessageBubble.vue";
import MessageFailedIndicator from "./MessageFailedIndicator.vue";
import {
  resolveMessageRenderModel,
  type MessageRendererRegistry,
} from "@/features/chat/message-flow/message/domain/messageRendererResolver";
import type { RenderableChatMessage } from "@/features/chat/message-flow/message/domain/messageModels";
import CoreTextMessageBubble from "./CoreTextMessageBubble.vue";
import MergedForwardBubble from "./MergedForwardBubble.vue";
import FileRefMessageBubble from "./FileRefMessageBubble.vue";
import ReactionBar from "./ReactionBar.vue";
import { currentChatUserId } from "@/features/chat/composition/chatAccountSession";
import { getAccountCapabilities } from "@/features/account/api";

const props = defineProps<{
  /**
   * 原始聊天消息。
   */
  message: RenderableChatMessage;
  /**
   * 消息所属频道 id（用于代码审查注释分区）。
   */
  channelId?: string;
  /**
   * 回复预览文本（仅 core-text 使用）。
   */
  replyText?: string;
  /**
   * domain registry（来自父级 store）。
   */
  domainRegistryStore: unknown;
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
   * 打开图片灯箱。
   */
  (event: "openLightbox", payload: { url: string; fileName: string; isVideo?: boolean }): void;
  /**
   * 查看合并转发消息详情。
   */
  (event: "viewForwardDetail", payload: { fromName: string; forwardedMessages: Array<{ messageId: string; channelId: string; userId: string; preview: string; sentTime: number }>; comment?: string }): void;
  /**
   * 发送失败后重试。
   */
  (event: "retry", messageId: string): void;
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
 * 当前用户显示名（用于代码审查注释作者展示）。
 */
const currentUserName = computed(() => {
  const snapshot = getAccountCapabilities().currentUser.getSnapshot();
  return snapshot.username || String(currentChatUserId.value);
});

/**
 * 消息是否已被编辑过（通过 editedAt 时间戳判断）。
 */
const isEdited = computed(() => {
  if (props.message.kind !== "core_text" && props.message.kind !== "domain_message") return false;
  return "editedAt" in props.message && props.message.editedAt != null && props.message.editedAt > 0;
});

/**
 * 判断消息是否已被撤回。
 */
const isRecalled = computed(() => {
  return "recalledAt" in props.message && props.message.recalledAt != null && props.message.recalledAt > 0;
});

/**
 * 判断消息发送是否失败。
 * 仅 image 类消息携带 status 字段，其余类型无发送状态。
 */
const isFailed = computed(() => {
  return "status" in props.message && props.message.status === "failed";
});

/**
 * 获取发送失败的错误信息。
 */
const sendFailedError = computed<string | undefined>(() => {
  if (!isFailed.value) return undefined;
  return "sendError" in props.message ? props.message.sendError : undefined;
});

/**
 * 消息是否已置顶。
 * 初始实现通过消息属性判断，后续接入 pin 列表时填充真实数据。
 */
const isPinned = computed(() => {
  return (props.message as { isPinned?: boolean }).isPinned ?? false;
});

const isMergedForward = computed(() => {
  return "forwardedMessages" in props.message && Array.isArray(props.message.forwardedMessages) && props.message.forwardedMessages.length > 0;
});

const mergedForwardData = computed(() => {
  if (!isMergedForward.value) return null;
  return {
    fromName: props.message.from.name,
    forwardedMessages: props.message.forwardedMessages as Array<{ messageId: string; channelId: string; userId: string; preview: string; sentTime: number }>,
    comment: props.message.kind === "core_text" ? props.message.text : undefined,
  };
});

/**
 * 判断当前消息是否为语音消息（Core:Voice 或旧 Voice:Message）。
 */
const isVoiceMessage = computed(() => {
  const id = props.message.domain.id;
  return id === "Core:Voice" || id === "Voice:Message";
});

/**
 * 语音消息数据（从 message.data 中提取；兼容 snake_case / camelCase）。
 */
const voiceMessageData = computed<{ shareKey?: string; durationMs?: number } | null>(() => {
  if (!isVoiceMessage.value) return null;
  if (!("data" in props.message) || !props.message.data) return null;
  const data = props.message.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  const shareKey = String(data.share_key ?? data.shareKey ?? "").trim();
  const durationMs = Number(data.duration_millis ?? data.durationMs ?? 0);
  return {
    shareKey,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0,
  };
});

/**
 * 判断当前消息是否为 Core:File。
 */
const isCoreFileMessage = computed(() => props.message.domain.id === "Core:File");

/**
 * Core:File 消息数据。
 */
const coreFileData = computed<{
  shareKey: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
} | null>(() => {
  if (!isCoreFileMessage.value) return null;
  if (!("data" in props.message) || !props.message.data) return null;
  const data = props.message.data as Record<string, unknown>;
  if (!data || typeof data !== "object") return null;
  const shareKey = String(data.share_key ?? data.shareKey ?? "").trim();
  if (!shareKey) return null;
  return {
    shareKey,
    filename: String(data.filename ?? data.text ?? shareKey).trim() || shareKey,
    mimeType: String(data.mime_type ?? data.mimeType ?? "").trim() || undefined,
    sizeBytes: Number(data.size ?? data.sizeBytes ?? 0) || undefined,
  };
});

/**
 * 链接预览数据（从消息中提取）。
 */
const messageLinkPreview = computed(() => {
  if ("linkPreview" in props.message) return props.message.linkPreview ?? null;
  return null;
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
    <div class="cp-messageContent">
      <!-- 置顶标记 -->
      <span v-if="isPinned" class="cp-pinBadge" :title="t('pinned_message')"><AppIcon name="pin" :size="12" :stroke-width="1.75" /></span>
      <!-- 语音消息（Core:Voice / Voice:Message） -->
      <VoiceMessageBubble
      v-if="isVoiceMessage && voiceMessageData && voiceMessageData.shareKey"
      :share-key="voiceMessageData.shareKey"
      :duration-ms="voiceMessageData.durationMs ?? 0"
    />
    <FileRefMessageBubble
      v-else-if="isCoreFileMessage && coreFileData"
      :filename="coreFileData.filename"
      :share-key="coreFileData.shareKey"
      :mime-type="coreFileData.mimeType"
      :size-bytes="coreFileData.sizeBytes"
      @openLightbox="(payload) => emit('openLightbox', payload)"
    />
    <MergedForwardBubble
      v-else-if="isMergedForward && mergedForwardData"
      :message-id="props.message.id"
      :from-name="mergedForwardData.fromName"
      :forwarded-messages="mergedForwardData.forwardedMessages"
      :comment="mergedForwardData.comment"
      @viewDetail="emit('viewForwardDetail', { fromName: mergedForwardData.fromName, forwardedMessages: mergedForwardData.forwardedMessages, comment: mergedForwardData.comment })"
    />
    <!-- 图片消息 -->
    <ImageMessageBubble
      v-else-if="props.message.kind === 'image'"
      :url="props.message.url"
      :thumb-url="props.message.thumbUrl"
      :file-name="props.message.fileName"
      :file-size="props.message.fileSize"
      :width="props.message.width"
      :height="props.message.height"
      @openLightbox="(payload) => emit('openLightbox', payload)"
    />
    <!-- 视频消息 -->
    <VideoMessageBubble
      v-else-if="props.message.kind === 'video'"
      :url="props.message.url"
      :thumb-url="props.message.thumbUrl"
      :file-name="props.message.fileName"
      :file-size="props.message.fileSize"
      :width="props.message.width"
      :height="props.message.height"
      :duration="props.message.duration"
      @openLightbox="(payload) => emit('openLightbox', payload)"
    />
    <CoreTextMessageBubble
      v-else-if="renderModel.kind === 'core'"
      :message-id="renderModel.messageId"
      :channel-id="props.channelId"
      :text="renderModel.text"
      :reply-text="renderModel.replyText"
      :reply="props.message.kind === 'core_text' ? props.message.replyTo : undefined"
      :mentions="props.message.kind === 'core_text' ? props.message.mentions : undefined"
      :quote-reply="props.message.kind === 'core_text' ? props.message.quoteReply : undefined"
      :forwarded-from="props.message.kind === 'core_text' ? props.message.forwardedFrom : undefined"
      :is-edited="isEdited"
      :is-own="isOwn"
      :link-preview="messageLinkPreview"
      :current-user-id="currentChatUserId"
      :current-user-name="currentUserName"
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
      v-else-if="renderModel.kind === 'unknown'"
      :domain-id="renderModel.domainId"
      :domain-version="renderModel.domainVersion"
      :plugin-id-hint="renderModel.pluginIdHint || ''"
      :preview="renderModel.preview"
      @install="handleInstall"
    />
    <!-- 发送失败指示器 -->
    <MessageFailedIndicator
      v-if="isFailed"
      :message-id="props.message.id"
      :error="sendFailedError"
      @retry="(mid: string) => emit('retry', mid)"
    />
    <ReactionBar
      :message-id="props.message.id"
      :reactions="props.message.reactions ?? []"
      @react="(messageId, emoji) => emit('react', messageId, emoji)"
    />
    </div>
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

/* 消息内容包装容器，为置顶标记提供定位上下文 */
.cp-messageContent {
  position: relative;
}

/* 置顶标记（pin 图标） */
.cp-pinBadge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 12px;
  user-select: none;
  pointer-events: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--cp-accent);
}
</style>
