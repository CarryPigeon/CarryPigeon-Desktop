<script setup lang="ts">
/**
 * @fileoverview ForwardChannelDialog.vue
 * @description chat｜组件：ForwardChannelDialog，转发消息时选择目标频道。
 */

import { ref, computed, watch, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { debounce } from "@/shared/utils/rateLimit";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";

const props = defineProps<{
  visible: boolean;
  forwardMode: "merged" | "separate";
  messageCount: number;
  channels: readonly ChannelSummary[];
  isForwarding?: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm", payload: { targetCid: string; comment: string }): void;
  (e: "cancel"): void;
}>();

const { t } = useI18n();

const searchQuery = ref("");
const selectedChannelId = ref("");
const comment = ref("");

const debouncedQuery = ref("");

const updateDebouncedQuery = debounce((val: string) => {
  debouncedQuery.value = val;
}, 300);

watch(searchQuery, (val) => {
  updateDebouncedQuery(val);
});

onBeforeUnmount(() => {
  updateDebouncedQuery.cancel();
});

const filteredChannels = computed(() => {
  const q = debouncedQuery.value.trim().toLowerCase();
  if (!q) return props.channels;
  return props.channels.filter((ch) => ch.name.toLowerCase().includes(q));
});

const confirmLabel = computed(() => {
  return props.forwardMode === "merged"
    ? t("forward_confirm_merged", { count: props.messageCount })
    : t("forward_confirm_separate", { count: props.messageCount });
});

const canConfirm = computed(() => !!selectedChannelId.value && !props.isForwarding);

function handleSelect(channelId: string): void {
  selectedChannelId.value = channelId;
}

function handleConfirm(): void {
  if (!canConfirm.value) return;
  emit("confirm", { targetCid: selectedChannelId.value, comment: comment.value.trim() });
}

function handleClose(): void {
  emit("cancel");
}

watch(() => props.visible, (v) => {
  if (v) {
    searchQuery.value = "";
    debouncedQuery.value = "";
    selectedChannelId.value = "";
    comment.value = "";
  }
});
</script>

<template>
  <t-dialog
    :visible="props.visible"
    :header="t('forward_select_channel')"
    :footer="false"
    @close="handleClose"
  >
    <div class="cp-forwardDialog">
      <div class="cp-forwardDialog__search">
        <t-input
          v-model="searchQuery"
          :placeholder="t('search_bar')"
          clearable
        />
      </div>
      <div class="cp-forwardDialog__list">
        <div v-if="filteredChannels.length === 0" class="cp-forwardDialog__empty">
          {{ t("forward_no_channels") }}
        </div>
        <div
          v-for="ch in filteredChannels"
          :key="ch.id"
          class="cp-forwardDialog__channel"
          :data-selected="ch.id === selectedChannelId"
          @click="handleSelect(ch.id)"
        >
          <span class="cp-forwardDialog__channelHash">#</span>
          <span class="cp-forwardDialog__channelName">{{ ch.name }}</span>
        </div>
      </div>
      <div class="cp-forwardDialog__comment">
        <t-textarea
          v-model="comment"
          :placeholder="t('forward_comment_placeholder')"
          :maxlength="500"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
      </div>
      <div class="cp-forwardDialog__actions">
        <button class="cp-forwardDialog__btn" type="button" @click="handleClose">
          {{ t("cancel") }}
        </button>
        <button
          class="cp-forwardDialog__btn cp-forwardDialog__btn--primary"
          type="button"
          :disabled="!canConfirm"
          @click="handleConfirm"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
.cp-forwardDialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 360px;
}
.cp-forwardDialog__list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--cp-border, #313244);
  border-radius: 8px;
}
.cp-forwardDialog__empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: var(--cp-text-muted, #a6adc8);
}
.cp-forwardDialog__channel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid var(--cp-border-light, rgba(49, 50, 68, 0.4));
  font-size: 13px;
  transition: background-color 0.15s;

  &:last-child { border-bottom: none; }
  &:hover { background: var(--cp-hover-bg, rgba(255,255,255,0.04)); }

  &[data-selected="true"] {
    background: color-mix(in oklab, var(--cp-primary) 12%, transparent);
  }
}
.cp-forwardDialog__channelHash {
  color: var(--cp-text-muted, #a6adc8);
}
.cp-forwardDialog__channelName {
  color: var(--cp-text, #cdd6f4);
}
.cp-forwardDialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.cp-forwardDialog__btn {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--cp-border, #313244);
  background: transparent;
  color: var(--cp-text, #cdd6f4);
  font-size: 13px;
  cursor: pointer;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}
.cp-forwardDialog__btn--primary {
  background: var(--cp-primary);
  border-color: var(--cp-primary);
  color: #fff;
}
</style>
