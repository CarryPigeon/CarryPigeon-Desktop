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
import UnknownDomainCard from "./UnknownDomainCard.vue";
import {
  resolveMessageRenderModel,
  type MessageRendererRegistry,
} from "@/features/chat/message-flow/message/domain/messageRendererResolver";
import type { RenderableChatMessage } from "@/features/chat/message-flow/message/domain/messageModels";
import CoreTextMessageBubble from "./CoreTextMessageBubble.vue";

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
}>();

const emit = defineEmits<{
  /**
   * 未知 domain 场景下触发安装提示。
   */
  (event: "install", pluginId: string | undefined): void;
}>();

const registry = computed<MessageRendererRegistry>(() => props.domainRegistryStore as MessageRendererRegistry);

const renderModel = computed(() =>
  resolveMessageRenderModel(props.message, String(props.replyText ?? ""), registry.value),
);

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
  <CoreTextMessageBubble
    v-if="renderModel.kind === 'core'"
    :message-id="renderModel.messageId"
    :text="renderModel.text"
    :reply-text="renderModel.replyText"
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
</template>
