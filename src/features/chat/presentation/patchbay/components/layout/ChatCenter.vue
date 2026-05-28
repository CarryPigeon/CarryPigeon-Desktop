<script setup lang="ts">
/**
 * @fileoverview ChatCenter.vue
 * @description Patchbay 中央消息区：顶部状态、消息流、编辑器。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChatCenterModel } from "@/features/chat/presentation/patchbay/view-models/useChatCenterModel";
import type { CallState } from "@/features/chat/voice-call/domain/contracts";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { UserProfilePopover } from "@/features/account/components";
import SignalStrip from "@/features/chat/message-flow/message/presentation/components/SignalStrip.vue";
import MessageContentHost from "@/features/chat/message-flow/message/presentation/components/MessageContentHost.vue";
import { reactToMessage } from "@/features/chat/message-flow/presentation/store-access/messageFlowStoreAccess";
import FileUploadButton from "@/features/chat/message-flow/upload/presentation/components/FileUploadButton.vue";
import MultiSelectToolbar from "@/features/chat/presentation/patchbay/components/menus/MultiSelectToolbar.vue";
import ComposerHost from "@/features/chat/presentation/patchbay/components/composer/ComposerHost.vue";
import VoiceCallHost from "@/features/chat/voice-call/presentation/components/VoiceCallHost.vue";
import VoiceCallTrigger from "@/features/chat/voice-call/presentation/components/VoiceCallTrigger.vue";
import ForwardChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/ForwardChannelDialog.vue";
import ForwardDetailDialog from "@/features/chat/presentation/patchbay/components/dialogs/ForwardDetailDialog.vue";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import ImageLightbox from "@/features/chat/message-flow/message/presentation/components/ImageLightbox.vue";
import { addFiles as addImageFiles } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";

const props = defineProps<{
  model: ChatCenterModel;
  /**
   * 语音通话目标用户 ID（在 DM 中为对方用户 ID）。
   */
  targetUserId?: string;
  /**
   * 是否展示”跳到底部”按钮。
   */
  showJumpToBottom: boolean;
  /**
   * 点击”跳到底部”的处理。
   */
  onJumpToBottom: () => void;
  /**
   * 滚动事件处理（由父级负责读取 signalPaneRef 并编排自动加载）。
   */
  onSignalScroll: () => void;
  /**
   * 注册 signal pane DOM 引用到父级（用于滚动定位与读状态上报）。
   */
  registerSignalPane: (el: HTMLElement | null) => void;
  /**
   * 打开频道设置菜单（⚙）。
   */
  onOpenChannelSettingsMenu: (e: MouseEvent) => void;
  /**
   * 打开消息上下文菜单（右键）。
   */
  onMessageContextMenu: (e: MouseEvent, messageId: string) => void;
  /**
   * 打开消息上下文菜单（⋯）。
   */
  onMoreClick: (e: MouseEvent, messageId: string) => void;
  /**
   * 安装提示：从未知 domain 卡片跳转到插件中心。
   */
  onInstallHint: (pluginId: string | undefined) => void;
  /**
   * 打开线程面板。
   */
  onViewThread?: (messageId: string) => void;
  channels: readonly ChannelSummary[];
  /**
   * 当前正在编辑的消息 ID。
   */
  editingMessageId?: string;
  /**
   * 编辑确认回调。
   */
  onEdit?: (messageId: string, text: string) => void;
  /**
   * 编辑取消回调。
   */
  onEditCancel?: () => void;
}>();

const { t } = useI18n();
const signalPaneEl = ref<HTMLElement | null>(null);
const connectionLabel = computed(() => {
  switch (props.model.connectionPillState) {
    case "connected":
      return t("connected");
    case "reconnecting":
      return t("reconnecting");
    case "offline":
    default:
      return t("offline");
  }
});
const connectionActionLabel = computed(() =>
  props.model.connectionPillState === "offline" ? t("retry") : "",
);

const voiceHostRef = ref<{
  callState: { value: CallState };
  startDirectCall: (targetUserId: string) => Promise<unknown>;
  startConference: () => Promise<unknown>;
} | null>(null);

const currentCallState = computed<CallState>(() => voiceHostRef.value?.callState?.value ?? "idle");

/** 图片灯箱状态。 */
const lightboxOpen = ref(false);
const lightboxImages = ref<{ url: string; filename: string }[]>([]);
const lightboxIndex = ref(0);

/** 拖拽上传高亮状态。 */
const isDragOver = ref(false);
let dragCounter = 0;

/** 合并转发详情弹窗状态。 */
const forwardDetailVisible = ref(false);
type ForwardedMessageEntry = { messageId: string; channelId: string; userId: string; preview: string; sentTime: number };
const forwardDetailData = ref<{
  fromName: string;
  forwardedMessages: ForwardedMessageEntry[];
  comment?: string;
}>({ fromName: "", forwardedMessages: [] });

/**
 * 打开合并转发详情弹窗。
 */
function openForwardDetail(payload: { fromName: string; forwardedMessages: ForwardedMessageEntry[]; comment?: string }): void {
  forwardDetailData.value = payload;
  forwardDetailVisible.value = true;
}

/**
 * 关闭合并转发详情弹窗。
 */
function closeForwardDetail(): void {
  forwardDetailVisible.value = false;
}

/**
 * 处理文件拖入。
 *
 * @param e - DragEvent。
 */
function handleDragEnter(e: DragEvent): void {
  if (e.dataTransfer?.types.includes("Files")) {
    dragCounter++;
    isDragOver.value = true;
  }
}

/**
 * 处理文件拖出。
 */
function handleDragLeave(): void {
  dragCounter--;
  if (dragCounter <= 0) {
    dragCounter = 0;
    isDragOver.value = false;
  }
}

/**
 * 处理文件放下。
 *
 * @param e - DragEvent。
 */
function handleDrop(e: DragEvent): void {
  e.preventDefault();
  dragCounter = 0;
  isDragOver.value = false;
  if (e.dataTransfer?.files?.length) {
    addImageFiles(e.dataTransfer.files);
  }
}

/**
 * 打开图片灯箱。
 *
 * @param payload - 包含图片 URL 和文件名的对象。
 */
function openLightbox(payload: { url: string; filename: string }): void {
  lightboxImages.value = [payload];
  lightboxIndex.value = 0;
  lightboxOpen.value = true;
}

/**
 * 关闭图片灯箱。
 */
function closeLightbox(): void {
  lightboxOpen.value = false;
  lightboxImages.value = [];
}

function handleDirectCallStart(targetUserId: string): void {
  voiceHostRef.value?.startDirectCall(targetUserId || props.targetUserId || "");
}

function handleConferenceStart(): void {
  voiceHostRef.value?.startConference();
}

/**
 * 将当前 signal pane DOM 引用回传给父级。
 *
 * @param el - 当前消息面板元素。
 */
function registerSignalPaneEl(el: HTMLElement | null): void {
  props.registerSignalPane(el);
}

watch(signalPaneEl, registerSignalPaneEl, { immediate: true });
onMounted(() => registerSignalPaneEl(signalPaneEl.value));
onBeforeUnmount(() => registerSignalPaneEl(null));
</script>

<template>
  <!-- 组件：ChatCenter｜职责：中央消息区（header / signal pane / composer） -->
  <!-- 区块：<section> .cp-center -->
  <section
    class="cp-center"
    :class="{ 'cp-center--dragOver': isDragOver }"
    @dragover.prevent
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
  >
    <header class="cp-topConsole">
      <div class="cp-topConsole__left">
        <div class="cp-topConsole__title">{{ t("messages_title") }}</div>
      </div>
      <div class="cp-topConsole__right">
        <VoiceCallTrigger
          v-if="props.model.currentChannelId"
          :room-id="props.model.currentChannelId"
          :room-name="props.model.currentChannelName"
          :call-state="currentCallState"
          :target-user-id="props.targetUserId"
          @start-direct="handleDirectCallStart"
          @start-conference="handleConferenceStart"
        />
        <button
          v-if="props.model.currentChannelId"
          class="cp-topConsole__search"
          type="button"
          @click="props.model.openSearchPanel"
          :aria-label="t('search_messages')"
          :title="t('search_messages')"
        >
          <t-icon name="search" />
        </button>
        <button
          v-if="props.model.currentChannelId"
          class="cp-topConsole__settings"
          type="button"
          @click="props.onOpenChannelSettingsMenu"
          :title="t('channel_settings')"
        >
          <t-icon name="setting" />
        </button>
        <ConnectionPill
          :state="props.model.connectionPillState"
          :label="connectionLabel"
          :detail="props.model.connectionDetail"
          :action-label="connectionActionLabel"
          @action="props.model.retryConnection"
        />
      </div>
    </header>

    <VoiceCallHost
      ref="voiceHostRef"
      :room-id="props.model.currentChannelId"
      :room-name="props.model.currentChannelName"
      :target-user-id="props.targetUserId"
    />

    <section v-if="props.model.searchPanelOpen" class="cp-searchPanel">
      <div class="cp-searchPanel__row">
        <t-select
          v-if="props.model.searchScope !== undefined"
          :value="props.model.searchScope"
          :options="[{ label: '当前频道', value: 'channel' }, { label: '全部频道', value: 'server' }]"
          size="small"
          style="width: 100px; flex-shrink: 0;"
          @change="(v: string) => props.model.setSearchScope(v as 'channel' | 'server')"
        />
        <t-input :placeholder="t('search_current_channel')" @enter="props.model.searchMessages" />
        <button type="button" class="cp-searchPanel__close" @click="props.model.closeSearchPanel">&times;</button>
      </div>
      <div v-if="props.model.searchState.loading" class="cp-searchPanel__state">{{ t("searching") }}</div>
      <div v-else-if="props.model.searchState.error" class="cp-searchPanel__state cp-searchPanel__error">{{ props.model.searchState.error }}</div>
      <div v-else-if="props.model.searchState.query && props.model.searchScope === 'channel' && !props.model.searchState.results.length" class="cp-searchPanel__state">{{ t("no_messages_found") }}</div>
      <div v-else-if="props.model.searchState.query && props.model.searchScope === 'server' && !props.model.searchState.serverResults.length" class="cp-searchPanel__state">{{ t("no_messages_found") }}</div>
      <div v-if="props.model.searchScope === 'channel'" class="cp-searchPanel__results">
        <button
          v-for="result in props.model.searchState.results"
          :key="result.message.id"
          type="button"
          class="cp-searchPanel__result"
          @click="props.model.openSearchResult(result.message.id)"
        >
          <div class="cp-searchPanel__resultSender">{{ result.message.from.name }}</div>
          <div class="cp-searchPanel__resultPreview">{{ result.preview }}</div>
        </button>
      </div>
      <div v-if="props.model.searchScope === 'server'" class="cp-searchPanel__results">
        <button
          v-for="result in props.model.searchState.serverResults"
          :key="result.message.id"
          type="button"
          class="cp-searchPanel__result"
          @click="props.model.openSearchResult(result.message.id)"
        >
          <div v-if="result.channelId" class="cp-searchPanel__resultChannel">#{{ result.channelName || result.channelId }}</div>
          <div class="cp-searchPanel__resultSender">{{ result.message.from.name }}</div>
          <div class="cp-searchPanel__resultPreview">{{ result.preview }}</div>
        </button>
      </div>
    </section>

    <MultiSelectToolbar
      v-if="props.model.multiSelectMode"
      :selected-count="props.model.selectedCount"
      @cancel="props.model.handleCancelMultiSelect"
      @forward-merged="props.model.handleBatchForwardMerged"
      @forward-separate="props.model.handleBatchForwardSeparate"
      @delete="props.model.handleBatchDelete"
      @bookmark="props.model.handleBatchBookmark"
    />
    <div ref="signalPaneEl" class="cp-signalPane" role="log" aria-label="messages" aria-live="polite" @scroll="props.onSignalScroll">
      <!-- 区块：游标分页（加载更早历史） -->
      <div v-if="props.model.currentChannelHasMore" class="cp-historyMore">
        <button
          class="cp-historyMore__btn"
          type="button"
          :disabled="props.model.loadingMoreMessages"
          @click="props.model.safeLoadMore"
        >
          {{ props.model.loadingMoreMessages ? t("loading") : t("load_older") }}
        </button>
      </div>

      <!-- 区块：消息列表（包含基于 lastReadTime 的“UNREAD”分隔符，mock 逻辑） -->
      <template v-for="{ m, isGroupStart, isUnreadStart } in props.model.messageRows" :key="m.id">
        <!-- 区块：未读边界 -->
        <div v-if="isUnreadStart" class="cp-unreadSep" role="separator" :aria-label="t('unread')">{{ t("unread") }}</div>
        <!-- 区块：消息行 -->
        <div
          class="cp-msg"
          :data-message-id="m.id"
          :data-highlighted="m.id === props.model.highlightedMessageId"
          :data-mine="m.from.id === props.model.currentUserId"
          :data-group-start="isGroupStart"
          :data-mentioned="props.model.isMentioned(m)"
          tabindex="0"
          role="article"
          :aria-label="`message ${m.domain.label} from ${m.from.name}`"
          @contextmenu="props.onMessageContextMenu($event, m.id)"
          @keydown="props.model.handleMessageKeydown($event, m.id)"
        >
          <!-- 区块：多选复选框 -->
          <div v-if="props.model.multiSelectMode" class="cp-msg__checkbox">
            <input
              type="checkbox"
              :checked="props.model.isMessageSelected(m.id)"
              @change="props.model.toggleMessageSelection(m.id)"
            />
          </div>
          <!-- 区块：头像列（仅 group-start 可见；预留空间用于对齐） -->
          <div class="cp-msg__avatar" :data-visible="isGroupStart">
            <UserProfilePopover
              :user-id="m.from.id"
              :username="m.from.name"
              trigger="hover"
            >
              <AvatarBadge :name="m.from.name" :size="28" />
            </UserProfilePopover>
          </div>
          <!-- 区块：domain 色条列 -->
          <div class="cp-msg__strip">
            <SignalStrip :color-var="m.domain.colorVar" />
          </div>
          <!-- 区块：内容列（meta + bubble/card） -->
          <div class="cp-msg__body">
            <!-- 区块：meta 行 -->
            <div class="cp-msg__meta" :data-compact="!isGroupStart">
              <span v-if="isGroupStart" class="cp-msg__from">{{ m.from.name }}</span>
              <span class="cp-msg__dot"></span>
              <span class="cp-msg__time">{{ props.model.fmtTime(m.timeMs) }}</span>
              <span class="cp-msg__dot"></span>
              <span class="cp-msg__domain">{{ m.domain.label }}</span>
              <button class="cp-msg__more" type="button" :aria-label="t('more_actions')" @click="props.onMoreClick($event, m.id)">⋯</button>
            </div>

            <!-- 区块：消息内容渲染宿主（core/plugin/unknown 分发） -->
            <MessageContentHost
              :message="m"
              :reply-text="m.replyToId ? props.model.formatReplyMiniText(props.model.currentChannelId, m.replyToId) : ''"
              :domain-registry-store="props.model.domainRegistryStore"
              :editing-message-id="props.editingMessageId"
              @install="props.onInstallHint"
              @react="(messageId, emoji) => emoji && reactToMessage(messageId, emoji)"
              @edit="(payload) => props.onEdit?.(payload.messageId, payload.text)"
              @edit-cancel="props.onEditCancel?.()"
              @openLightbox="openLightbox"
              @viewThread="(messageId) => props.onViewThread?.(messageId)"
              @viewForwardDetail="openForwardDetail"
            />
          </div>
        </div>
      </template>

      <button
        v-if="props.showJumpToBottom"
        class="cp-jumpBottom"
        type="button"
        :aria-label="t('jump_to_bottom')"
        :title="t('jump_to_bottom')"
        @click="props.onJumpToBottom"
      >
        ↓
      </button>
    </div>

    <div class="cp-composerPane">
      <div class="cp-composerActions">
        <FileUploadButton @uploaded="props.model.handleFileUploaded" @error="props.model.handleFileUploadError" />
      </div>
      <ComposerHost
        :domain-id="props.model.selectedDomainId"
        :domain-options="props.model.domainOptions"
        :draft="props.model.composerDraft"
        :reply-title="props.model.replyPreview.title"
        :reply-snippet="props.model.replyPreview.snippet"
        :reply-to-mid="props.model.replyToMessageId"
        :error="props.model.messageActionError"
        :plugin-composer="props.model.activePluginComposer"
        :plugin-context="props.model.activePluginContext"
        :mention-candidates="props.model.mentionCandidates"
        :mention-menu-open="props.model.mentionMenuOpen"
        :current-user-role="props.model.currentUserRole"
        :quote-reply-draft="props.model.quoteReplyDraft"
        :link-preview="props.model.linkPreview"
        @update:domainId="props.model.setDomainId"
        @update:draft="props.model.setDraft"
        @send="props.model.handleSend"
        @cancelReply="props.model.handleCancelReply"
        @cancel-quote-reply="props.model.handleCancelQuoteReply"
        @mention-query="props.model.handleMentionQuery"
        @select-mention="props.model.handleSelectMention"
        @close-mention-menu="props.model.handleMentionMenuClose"
        @url-detected="(url: string) => props.model.fetchLinkPreview(url)"
        @dismiss-link-preview="props.model.dismissLinkPreview"
      />
    </div>

    <ForwardChannelDialog
      :visible="props.model.showForwardDialog"
      :forward-mode="props.model.forwardMode"
      :message-count="props.model.forwardMessageCount"
      :channels="props.channels"
      :is-forwarding="props.model.isForwarding"
      @confirm="props.model.handleForwardConfirm"
      @cancel="props.model.closeForwardDialog"
    />

    <ForwardDetailDialog
      :visible="forwardDetailVisible"
      :from-name="forwardDetailData.fromName"
      :forwarded-messages="forwardDetailData.forwardedMessages"
      :comment="forwardDetailData.comment"
      @close="closeForwardDetail"
    />

    <ImageLightbox
      v-if="lightboxOpen"
      :images="lightboxImages"
      :initial-index="lightboxIndex"
      @close="closeLightbox"
    />
  </section>
</template>

<style scoped lang="scss">
.cp-msg[data-mentioned="true"] {
  background: color-mix(in oklab, var(--cp-warning) 10%, transparent);
  border-radius: 14px;
}
.cp-msg[data-highlighted="true"] {
  background: color-mix(in oklab, var(--cp-primary) 12%, transparent);
  border-radius: 14px;
  outline: 2px solid var(--cp-primary);
  outline-offset: -2px;
}
.cp-searchPanel {
  border-bottom: 1px solid var(--cp-border-color, #e0e0e0);
  background: var(--cp-bg-secondary, #fafafa);
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow: hidden;
}
.cp-searchPanel__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cp-searchPanel__close {
  border: none;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.cp-searchPanel__state {
  font-size: 13px;
  color: var(--cp-text-secondary, #888);
  padding: 4px 0;
}
.cp-searchPanel__error {
  color: var(--cp-danger, #e34);
}
.cp-searchPanel__results {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  max-height: 160px;
}
.cp-searchPanel__result {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}
.cp-searchPanel__result:hover {
  background: color-mix(in oklab, var(--cp-primary) 8%, transparent);
}
.cp-searchPanel__resultSender {
  font-weight: 600;
  color: var(--cp-text-primary, #222);
}
.cp-searchPanel__resultChannel {
  font-size: 11px;
  color: var(--cp-accent, #5865f2);
  font-weight: 500;
  margin-bottom: 1px;
}
.cp-searchPanel__resultPreview {
  color: var(--cp-text-secondary, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cp-center--dragOver {
  outline: 3px dashed var(--cp-accent, #5865f2);
  outline-offset: -3px;
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 4%, transparent);
}

.cp-msg__checkbox {
  display: flex;
  align-items: flex-start;
  padding: 8px 4px;
  flex-shrink: 0;
}
</style>
