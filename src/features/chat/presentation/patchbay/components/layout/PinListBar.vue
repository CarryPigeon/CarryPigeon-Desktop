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
        <AppIcon :name="expanded ? 'chevron-up' : 'chevron-down'" />
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
          <AppIcon name="close" />
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
      <AppIcon name="close" />
    </button>
  </div>

  <div v-else-if="loading" class="cp-pinListBar cp-pinListBar--loading" role="region" :aria-label="t('loading')">
    <span class="cp-pinListBar__icon"><AppIcon name="pin" :size="13" :stroke-width="1.75" /></span>
    <span>{{ t('loading') }}...</span>
  </div>
</template>

<style scoped lang="scss">
/* 样式：PinListBar｜规格：频道面板内工具条（胶囊头部 + 图标按钮，无位移 hover） */
.cp-pinListBar {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 4px 8px;
  background: var(--cp-panel-muted);
  font-size: 12px;
  position: relative;
}

.cp-pinListBar--loading {
  align-items: center;
  padding: 4px 8px;
  color: var(--cp-text-muted);
}

/* 折叠/展开头：胶囊按钮（pin 图标 + 计数 + chevron） */
.cp-pinListBar__header {
  @include cp-pill-button;

  gap: 6px;
  min-height: 24px;
  padding: 0 8px;
  font-size: 11.5px;
  flex: 0 0 auto;
  white-space: nowrap;
  color: var(--cp-text-muted);
}

.cp-pinListBar__icon {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  flex-shrink: 0;
  color: var(--cp-accent);
}

.cp-pinListBar__count {
  font-weight: 600;
  font-size: 11.5px;
}

.cp-pinListBar__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: var(--cp-text-muted);
  padding: 0;
  cursor: pointer;
}

.cp-pinListBar__items {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  max-height: 28px;
  overflow: hidden;
}

.cp-pinListBar__items[data-expanded="true"] {
  max-height: none;
}

/* 置顶行：行底色 hover，不做位移 */
.cp-pinListBar__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  border-radius: var(--cp-radius-sm);
  cursor: pointer;
  transition: background-color var(--cp-fast) var(--cp-ease);
}

.cp-pinListBar__item:hover {
  background: var(--cp-hover-bg);
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

/* 取消置顶：图标按钮，hover 才显示 */
.cp-pinListBar__itemUnpin {
  @include cp-icon-button;

  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 11px;
  flex-shrink: 0;
  opacity: 0;
  transition:
    opacity var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);

  &:hover:not(:disabled) {
    color: var(--cp-danger);
    background: var(--cp-danger-bg);
    border-color: var(--cp-danger-border);
  }
}

.cp-pinListBar__item:hover .cp-pinListBar__itemUnpin,
.cp-pinListBar__itemUnpin:focus-visible {
  opacity: 1;
}

/* 关闭工具条：图标按钮 */
.cp-pinListBar__dismiss {
  @include cp-icon-button;

  width: 24px;
  height: 24px;
  flex-shrink: 0;
}
</style>
