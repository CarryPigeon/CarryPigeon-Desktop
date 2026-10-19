<script setup lang="ts">
/**
 * @fileoverview ThreadPanel.vue
 * @description chat｜线程面板模态组件（含虚拟滚动）。
 */

import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useVirtualizer } from "@tanstack/vue-virtual";
import ThreadRootCard from "./ThreadRootCard.vue";
import MessageContentHost from "@/features/chat/message-flow/message/presentation/components/MessageContentHost.vue";
import type { ChatMessage } from "@/features/chat/message-flow/api-types";
import type { useThreadPanelModel } from "./useThreadPanelModel";
import AppIcon from "@/shared/ui/AppIcon.vue";

const { t } = useI18n();

const props = defineProps<{
  model: ReturnType<typeof useThreadPanelModel>;
  domainRegistryStore: unknown;
}>();

defineEmits<{
  (e: "close"): void;
}>();

const repliesScrollEl = ref<HTMLElement | null>(null);

const replyVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.model.replies.value.length,
    getScrollElement: () => repliesScrollEl.value,
    estimateSize: () => 60,
    overscan: 8,
  }))
);
</script>

<template>
  <teleport to="body">
    <div v-if="props.model.open.value" class="cp-threadOverlay" @click.self="$emit('close')">
      <div class="cp-threadPanel">
        <div class="cp-threadPanel__header">
          <h3>{{ t("thread") }}</h3>
          <button class="cp-threadPanel__close" @click="$emit('close')"><AppIcon name="close" /></button>
        </div>

        <div class="cp-threadPanel__body">
          <ThreadRootCard
            v-if="props.model.rootMessage.value"
            :message="props.model.rootMessage.value"
          />

          <div v-if="props.model.loading.value" class="cp-threadPanel__loading">{{ t("loading") }}</div>

          <template v-else>
            <div v-if="props.model.replies.value.length === 0" class="cp-threadPanel__empty">
              {{ t("no_replies_yet") }}
            </div>
            <div
              v-else
              ref="repliesScrollEl"
              class="cp-threadPanel__repliesScroll"
            >
              <div :style="{ height: `${replyVirtualizer.getTotalSize()}px`, position: 'relative' }">
                <div
                  v-for="vr in replyVirtualizer.getVirtualItems()"
                  :key="String(vr.key)"
                  :ref="(el: unknown) => { if (el && (el as Element).parentNode) replyVirtualizer.measureElement(el as Element); }"
                  :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vr.start}px)` }"
                  class="cp-threadPanel__reply"
                >
                  <MessageContentHost
                    :message="(props.model.replies.value[vr.index] as unknown) as ChatMessage"
                    :channel-id="props.model.currentChannelId"
                    :domain-registry-store="props.domainRegistryStore"
                  />
                </div>
              </div>
            </div>
          </template>
        </div>

        <div class="cp-threadPanel__composer">
          <t-textarea
            v-model="props.model.draft.value"
            :placeholder="t('reply_in_thread')"
            :autosize="{ minRows: 1, maxRows: 4 }"
            @keydown.enter.exact.prevent="props.model.sendReply()"
          />
          <button
            class="cp-threadPanel__send"
            :disabled="!props.model.draft.value.trim() || props.model.sending.value"
            @click="props.model.sendReply()"
          >
            {{ props.model.sending.value ? "…" : t("send") }}
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped lang="scss">
/* 样式：ThreadPanel｜规格：模糊遮罩 + 18px 玻璃浮层 + 胶囊发送 */
.cp-threadOverlay {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: color-mix(in oklab, var(--cp-bg) 48%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.cp-threadPanel {
  @include cp-glass-panel;

  width: 560px;
  max-width: min(560px, 92vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.cp-threadPanel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--cp-border-light);
}

.cp-threadPanel__header h3 {
  margin: 0;
  font-family: var(--cp-font-display);
  font-weight: 900;
  font-size: 15px;
  letter-spacing: 0.04em;
  color: var(--cp-text);
}

.cp-threadPanel__close {
  @include cp-icon-button;
}

.cp-threadPanel__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 16px;
}

.cp-threadPanel__repliesScroll {
  margin-top: 4px;
  overflow-y: auto;
  max-height: 400px;
}

.cp-threadPanel__empty,
.cp-threadPanel__loading {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted);
}

.cp-threadPanel__composer {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  padding: 12px 16px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-threadPanel__composer :deep(.t-textarea__inner) {
  min-height: 36px;
}

.cp-threadPanel__send {
  @include cp-pill-button(primary);

  flex-shrink: 0;
}
</style>
.cp-threadPanel__send:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
