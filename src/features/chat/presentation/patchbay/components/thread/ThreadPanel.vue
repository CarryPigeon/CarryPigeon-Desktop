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
          <button class="cp-threadPanel__close" @click="$emit('close')">&times;</button>
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

<style scoped>
.cp-threadOverlay {
  position: fixed; z-index: 80; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; justify-content: center; align-items: center;
}
.cp-threadPanel {
  width: 560px; max-height: 80vh;
  background: var(--cp-panel); border-radius: 18px;
  box-shadow: var(--cp-shadow);
  display: flex; flex-direction: column;
}
.cp-threadPanel__header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; border-bottom: 1px solid var(--cp-border);
}
.cp-threadPanel__header h3 { font-size: 16px; margin: 0; color: var(--cp-text); }
.cp-threadPanel__close {
  border: 1px solid var(--cp-border); background: var(--cp-panel-muted);
  color: var(--cp-text); border-radius: 999px; width: 28px; height: 28px;
  display: inline-grid; place-items: center; cursor: pointer;
  font-size: 16px; line-height: 1;
}
.cp-threadPanel__body { flex: 1; overflow-y: auto; padding: 16px 20px; }
.cp-threadPanel__repliesScroll { margin-top: 4px; overflow-y: auto; max-height: 400px; }
.cp-threadPanel__empty, .cp-threadPanel__loading { color: var(--cp-text-muted); font-size: 13px; text-align: center; padding: 24px; }
.cp-threadPanel__composer {
  display: flex; gap: 8px; align-items: flex-end;
  padding: 12px 20px; border-top: 1px solid var(--cp-border);
}
.cp-threadPanel__composer :deep(.t-textarea__inner) { min-height: 36px; }
.cp-threadPanel__send {
  padding: 8px 16px; border-radius: 999px; flex-shrink: 0;
  border: 1px solid var(--cp-accent-soft); background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
  color: var(--cp-text); cursor: pointer; font-size: 12px;
}
.cp-threadPanel__send:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
