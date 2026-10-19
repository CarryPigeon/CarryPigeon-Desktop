<script setup lang="ts">
/**
 * @fileoverview PinnedChannelsDialog.vue
 * @description chat｜组件：置顶频道编辑器（置顶 / 取消置顶 / 拖拽与按钮排序），替代手动编辑本机 JSON。
 *
 * 交互约定：弹窗内只维护本地草稿，点「保存」时一次性提交整份有序列表；
 * 顺序即左侧频道栏置顶分组的展示顺序。
 */

import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import {
  addPin,
  movePin,
  normalizePinOrder,
  removePin,
  reorderPin,
} from "@/features/chat/channel-pins/domain/channelPinOrder";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  /** 弹窗可见性。 */
  visible: boolean;
  /** 当前服务器展示名（用于说明文案）。 */
  serverName?: string;
  /** 当前服务器全部已加入频道；未置顶项作为候选。 */
  channels: readonly ChannelSummary[];
  /** 当前服务器已置顶频道 ID（有序）。 */
  pinnedIds: readonly string[];
  /** 保存中：禁用保存按钮，避免重复提交。 */
  saving?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "confirm", orderedIds: string[]): void;
}>();

const { t } = useI18n();

const draftOrder = ref<string[]>([]);
const searchQuery = ref("");
const dragIndex = ref<number | null>(null);

// 仅在弹窗打开瞬间以外部置顶顺序重置草稿；打开期间的热加载事件不覆盖用户正在编辑的草稿。
watch(
  () => props.visible,
  (visible) => {
    if (!visible) return;
    draftOrder.value = normalizePinOrder(props.pinnedIds);
    searchQuery.value = "";
    dragIndex.value = null;
  },
  { immediate: true },
);

const channelById = computed(() => new Map(props.channels.map((channel) => [channel.id, channel])));

/** 已置顶行：目录中查不到的 id 保留占位名，保证仍可被移除或排序。 */
const pinnedRows = computed(() =>
  draftOrder.value.map((id) => ({
    id,
    name: channelById.value.get(id)?.name ?? t("channel_pins_editor_unknown_channel", { id }),
  })),
);

/** 候选行：未置顶且匹配搜索（名称或 ID）。 */
const candidateRows = computed(() => {
  const pinned = new Set(draftOrder.value);
  const query = searchQuery.value.trim().toLowerCase();
  return props.channels.filter((channel) => {
    if (pinned.has(channel.id)) return false;
    if (!query) return true;
    return channel.name.toLowerCase().includes(query) || channel.id.toLowerCase().includes(query);
  });
});

function handleVisible(value: boolean): void {
  if (!value) emit("update:visible", false);
}

function pinChannel(channelId: string): void {
  draftOrder.value = addPin(draftOrder.value, channelId);
}

function unpinChannel(channelId: string): void {
  draftOrder.value = removePin(draftOrder.value, channelId);
}

function moveChannel(channelId: string, delta: number): void {
  draftOrder.value = movePin(draftOrder.value, channelId, delta);
}

function onDragStart(index: number, event: DragEvent): void {
  dragIndex.value = index;
  if (!event.dataTransfer) return;
  event.dataTransfer.effectAllowed = "move";
  // 部分浏览器需要写入数据后才会真正开始拖拽。
  event.dataTransfer.setData("text/plain", String(index));
}

/** 拖拽经过时实时重排，松开即为最终顺序。 */
function onDragOver(index: number): void {
  const from = dragIndex.value;
  if (from === null || from === index) return;
  draftOrder.value = reorderPin(draftOrder.value, from, index);
  dragIndex.value = index;
}

function onDragEnd(): void {
  dragIndex.value = null;
}

function handleSave(): void {
  if (props.saving) return;
  emit("confirm", [...draftOrder.value]);
}
</script>

<template>
  <!-- 组件：PinnedChannelsDialog｜职责：置顶频道可视化编辑（无需手改 JSON） -->
  <t-dialog
    :visible="props.visible"
    :header="t('server_info_menu_edit_pinned_channels')"
    :footer="false"
    width="520px"
    attach="body"
    destroy-on-close
    @update:visible="(value: boolean) => handleVisible(value)"
    @close="handleVisible(false)"
  >
    <div class="cp-pinEditor">
      <div v-if="props.serverName" class="cp-pinEditor__subtitle">
        {{ t("channel_pins_editor_subtitle", { name: props.serverName }) }}
      </div>

      <t-input
        v-model="searchQuery"
        :placeholder="t('channel_pins_editor_search_placeholder')"
        :aria-label="t('channel_pins_editor_search_placeholder')"
        clearable
      />

      <section class="cp-pinEditor__section">
        <div class="cp-pinEditor__sectionHead">
          {{ t("channel_pins_editor_pinned_section", { n: pinnedRows.length }) }}
        </div>
        <p v-if="pinnedRows.length === 0" class="cp-pinEditor__empty">
          {{ t("channel_pins_editor_pinned_empty") }}
        </p>
        <ul v-else class="cp-pinEditor__list">
          <li
            v-for="(row, index) in pinnedRows"
            :key="row.id"
            class="cp-pinEditor__row"
            data-region="pinned"
            :data-channel-id="row.id"
            @dragover.prevent="onDragOver(index)"
            @drop.prevent="onDragEnd"
          >
            <span
              class="cp-pinEditor__handle"
              draggable="true"
              :title="t('channel_pins_editor_drag_handle')"
              :aria-label="t('channel_pins_editor_drag_handle')"
              @dragstart="onDragStart(index, $event)"
              @dragend="onDragEnd"
              ><AppIcon name="grip-vertical" /></span
            >
            <span class="cp-pinEditor__name" :title="row.id">{{ row.name }}</span>
            <span class="cp-pinEditor__actions">
              <button
                class="cp-pinEditor__iconBtn"
                type="button"
                :disabled="index === 0"
                :title="t('channel_pins_editor_move_up')"
                :aria-label="t('channel_pins_editor_move_up')"
                @click="moveChannel(row.id, -1)"
              >
                <AppIcon name="arrow-up" />
              </button>
              <button
                class="cp-pinEditor__iconBtn"
                type="button"
                :disabled="index === pinnedRows.length - 1"
                :title="t('channel_pins_editor_move_down')"
                :aria-label="t('channel_pins_editor_move_down')"
                @click="moveChannel(row.id, 1)"
              >
                <AppIcon name="arrow-down" />
              </button>
              <button
                class="cp-pinEditor__btn"
                type="button"
                @click="unpinChannel(row.id)"
              >
                {{ t("unpin_channel") }}
              </button>
            </span>
          </li>
        </ul>
      </section>

      <section class="cp-pinEditor__section">
        <div class="cp-pinEditor__sectionHead">
          {{ t("channel_pins_editor_available_section", { n: candidateRows.length }) }}
        </div>
        <p v-if="candidateRows.length === 0" class="cp-pinEditor__empty">
          {{ t("channel_pins_editor_available_empty") }}
        </p>
        <ul v-else class="cp-pinEditor__list">
          <li
            v-for="channel in candidateRows"
            :key="channel.id"
            class="cp-pinEditor__row"
            data-region="candidate"
            :data-channel-id="channel.id"
          >
            <span class="cp-pinEditor__name" :title="channel.brief || channel.id">
              {{ channel.name }}
            </span>
            <span class="cp-pinEditor__actions">
              <button class="cp-pinEditor__btn primary" type="button" @click="pinChannel(channel.id)">
                {{ t("pin_channel") }}
              </button>
            </span>
          </li>
        </ul>
      </section>

      <div class="cp-pinEditor__footer">
        <button class="cp-pinEditor__btn" type="button" @click="handleVisible(false)">
          {{ t("cancel") }}
        </button>
        <button
          class="cp-pinEditor__btn primary"
          type="button"
          :disabled="props.saving"
          @click="handleSave"
        >
          {{ props.saving ? t("loading") : t("save") }}
        </button>
      </div>
    </div>
  </t-dialog>
</template>

<style scoped lang="scss">
/* 样式：PinnedChannelsDialog｜规格：字段 + 分组行列表 + 胶囊/图标按钮 */
.cp-pinEditor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cp-pinEditor__subtitle {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
}

.cp-pinEditor__section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 分区头：中文文案不做 uppercase，用弱化小标题 */
.cp-pinEditor__sectionHead {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: 0.02em;
  color: var(--cp-text-muted);
}

.cp-pinEditor__empty {
  margin: 0;
  padding: 12px;
  border: 1px dashed var(--cp-border);
  border-radius: var(--cp-radius-control);
  font-size: 12px;
  color: var(--cp-text-muted);
  text-align: center;
}

/* 列表容器：内嵌卡片；行间细分隔线 */
.cp-pinEditor__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius-control);
  background: var(--cp-panel-muted);
}

.cp-pinEditor__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-top: 1px solid var(--cp-border-light);

  &:first-child {
    border-top: none;
  }

  &:hover {
    background: var(--cp-hover-bg);
  }
}

.cp-pinEditor__handle {
  flex: none;
  cursor: grab;
  color: var(--cp-text-muted);
  font-size: 13px;
  line-height: 1;
  user-select: none;
}

.cp-pinEditor__name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--cp-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-pinEditor__actions {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 动作按钮：胶囊按钮（主操作 = highlight） */
.cp-pinEditor__btn {
  @include cp-pill-button;

  min-height: 28px;
  padding: 0 10px;
  font-size: 11.5px;

  &.primary {
    @include cp-pill-button(primary);
  }
}

/* 排序图标按钮：统一图标按钮规格 */
.cp-pinEditor__iconBtn {
  @include cp-icon-button;

  width: 24px;
  height: 24px;
}

.cp-pinEditor__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--cp-border-light);
  padding-top: 12px;
}
</style>
