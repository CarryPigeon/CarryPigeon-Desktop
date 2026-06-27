<script setup lang="ts">
/**
 * @fileoverview PinListBar.vue
 * @description Patchbay 频道置顶消息摘要栏：
 *   - 折叠时显示最新一条置顶消息预览；
 *   - 展开后列出全部置顶消息；
 *   - 点击跳转到对应消息；
 *   - 支持关闭。
 */
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import AppIcon from "@/shared/ui/AppIcon.vue";
import type { ChatPinRecord } from "@/features/chat/domain/types/chatApiModels";

/**
 * 置顶消息摘要（供 PinListBar 消费）。
 */
export type PinSummary = {
  pin: ChatPinRecord;
  /** 消息内容预览文本。 */
  preview: string;
  /** 置顶者名称。 */
  pinnedByName: string;
  /** 消息发送者名称。 */
  senderName: string;
  /** 消息发送者 ID（用于判断当前是否自己发送）。 */
  senderId?: string;
};

const props = defineProps<{
  /** 置顶消息列表。 */
  pins: PinSummary[];
  /** 是否正在加载。 */
  loading?: boolean;
  /** 加载或获取失败的错误信息。 */
  error?: string | null;
}>();

const emit = defineEmits<{
  /** 选中某条置顶消息，跳转到消息位置。 */
  (event: "select", messageId: string): void;
  /** 关闭置顶摘要栏。 */
  (event: "dismiss"): void;
  /** 取消某条消息的置顶。 */
  (event: "unpin", messageId: string): void;
}>();

const { t } = useI18n();

const expanded = ref(false);
const dismissed = ref(false);

const hasPins = computed(() => props.pins.length > 0 && !dismissed.value);

const latestPin = computed(() => {
  if (props.pins.length === 0) return null;
  const sorted = [...props.pins].sort((a, b) => b.pin.pinnedAt - a.pin.pinnedAt);
  return sorted[0];
});

const displayPins = computed(() => {
  if (expanded.value) {
    return [...props.pins].sort((a, b) => b.pin.pinnedAt - a.pin.pinnedAt);
  }
  return latestPin.value ? [latestPin.value] : [];
});

function toggleExpanded(): void {
  expanded.value = !expanded.value;
}

function handleDismiss(): void {
  dismissed.value = true;
  emit("dismiss");
}

function handleSelect(messageId: string): void {
  emit("select", messageId);
}

function handleUnpin(messageId: string): void {
  emit("unpin", messageId);
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div v-if="hasPins" class="cp-pinListBar" role="region" :aria-label="t('pinned_messages')">
    <div class="cp-pinListBar__header" @click="toggleExpanded">
      <span class="cp-pinListBar__icon"><AppIcon name="pin" :size="13" :stroke-width="1.75" /></span>
      <span class="cp-pinListBar__count">{{ props.pins.length }} {{ props.pins.length === 1 ? t('pinned_message') : t('pinned_messages') }}</span>
      <button
        class="cp-pinListBar__toggle"
        type="button"
        :aria-expanded="expanded"
        :aria-label="expanded ? t('collapse') : t('expand')"
      >
        <t-icon :name="expanded ? 'chevron-up' : 'chevron-down'" />
      </button>
    </div>

    <div class="cp-pinListBar__items" :data-expanded="expanded">
      <div
        v-for="entry in displayPins"
        :key="entry.pin.messageId"
        class="cp-pinListBar__item"
        role="button"
        tabindex="0"
        @click="handleSelect(entry.pin.messageId)"
        @keydown.enter="handleSelect(entry.pin.messageId)"
        @keydown.space.prevent="handleSelect(entry.pin.messageId)"
      >
        <div class="cp-pinListBar__itemPreview">
          <span class="cp-pinListBar__itemSender">{{ entry.senderName }}</span>
          <span class="cp-pinListBar__itemText">{{ entry.preview }}</span>
        </div>
        <div class="cp-pinListBar__itemMeta">
          <span class="cp-pinListBar__itemPinner" :title="t('pinned_by') + ': ' + entry.pinnedByName">
            {{ entry.pinnedByName }}
          </span>
          <span class="cp-pinListBar__itemTime">{{ fmtTime(entry.pin.pinnedAt) }}</span>
        </div>
        <button
          class="cp-pinListBar__itemUnpin"
          type="button"
          :aria-label="t('unpin_message')"
          :title="t('unpin_message')"
          @click.stop="handleUnpin(entry.pin.messageId)"
        >
          <t-icon name="close" />
        </button>
      </div>
    </div>

    <button
      class="cp-pinListBar__dismiss"
      type="button"
      :aria-label="t('close')"
      :title="t('close')"
      @click="handleDismiss"
    >
      <t-icon name="close" />
    </button>
  </div>

  <div v-else-if="loading" class="cp-pinListBar cp-pinListBar--loading" role="region" :aria-label="t('loading')">
    <span class="cp-pinListBar__icon"><AppIcon name="pin" :size="13" :stroke-width="1.75" /></span>
    <span>{{ t('loading') }}...</span>
  </div>
</template>

<style scoped>
.cp-pinListBar {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
  background: var(--cp-surface);
  border-bottom: 1px solid var(--cp-border);
  font-size: 12px;
  position: relative;
}

.cp-pinListBar--loading {
  padding: 6px 12px;
  color: var(--cp-text-muted);
}

.cp-pinListBar__header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  padding-right: 4px;
  border-right: 1px solid var(--cp-border);
  color: var(--cp-text-muted);
}

.cp-pinListBar__header:hover {
  color: var(--cp-text);
}

.cp-pinListBar__icon {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  flex-shrink: 0;
  color: var(--cp-accent);
}

.cp-pinListBar__count {
  font-weight: 500;
  font-size: 11px;
}

.cp-pinListBar__toggle {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--cp-text-muted);
  padding: 0 2px;
  display: inline-flex;
  align-items: center;
}

.cp-pinListBar__items {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  max-height: 28px;
  overflow: hidden;
}

.cp-pinListBar__items[data-expanded="true"] {
  max-height: none;
}

.cp-pinListBar__item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.1s;
}

.cp-pinListBar__item:hover {
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 8%, transparent);
}

.cp-pinListBar__itemPreview {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;
}

.cp-pinListBar__itemSender {
  font-weight: 600;
  white-space: nowrap;
  color: var(--cp-text);
}

.cp-pinListBar__itemText {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--cp-text-muted);
}

.cp-pinListBar__itemMeta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.cp-pinListBar__itemPinner {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-pinListBar__itemUnpin {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 11px;
  color: var(--cp-text-muted);
  padding: 2px;
  border-radius: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s, color 0.1s;
}

.cp-pinListBar__item:hover .cp-pinListBar__itemUnpin {
  opacity: 1;
}

.cp-pinListBar__itemUnpin:hover {
  color: var(--cp-danger);
  background: color-mix(in oklab, var(--cp-danger) 10%, transparent);
}

.cp-pinListBar__dismiss {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--cp-text-muted);
  padding: 2px 4px;
  border-radius: 2px;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.1s;
}

.cp-pinListBar__dismiss:hover {
  opacity: 1;
  color: var(--cp-text);
}
</style>
