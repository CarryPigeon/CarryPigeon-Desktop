<script setup lang="ts">
/**
 * @fileoverview ChatCenter.vue
 * @description Patchbay 中央消息区：顶部状态、消息流、编辑器。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { invoke } from "@tauri-apps/api/core";
import type { ChatCenterModel } from "@/features/chat/presentation/patchbay/view-models/useChatCenterModel";
import type { CallState } from "@/features/chat/voice-call/domain/contracts";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import { UserProfilePopover } from "@/features/account/components";
import SignalStrip from "@/features/chat/message-flow/message/presentation/components/SignalStrip.vue";
import MessageContentHost from "@/features/chat/message-flow/message/presentation/components/MessageContentHost.vue";
import { reactToMessage } from "@/features/chat/message-flow/presentation/store-access/messageFlowStoreAccess";
import FileUploadButton from "@/features/chat/message-flow/upload/presentation/components/FileUploadButton.vue";
import StickerPickerButton from "@/features/chat/presentation/patchbay/components/composer/StickerPickerButton.vue";
import VoiceMessageRecorder from "@/features/chat/message-flow/message/presentation/components/VoiceMessageRecorder.vue";
import MultiSelectToolbar from "@/features/chat/presentation/patchbay/components/menus/MultiSelectToolbar.vue";
import ComposerHost from "@/features/chat/presentation/patchbay/components/composer/ComposerHost.vue";
import VoiceCallHost from "@/features/chat/voice-call/presentation/components/VoiceCallHost.vue";
import VoiceCallTrigger from "@/features/chat/voice-call/presentation/components/VoiceCallTrigger.vue";
import ForwardChannelDialog from "@/features/chat/presentation/patchbay/components/dialogs/ForwardChannelDialog.vue";
import ForwardDetailDialog from "@/features/chat/presentation/patchbay/components/dialogs/ForwardDetailDialog.vue";
import type { ChannelSummary } from "@/features/chat/shared-kernel/channelSummary";
import ImageLightbox from "@/features/chat/message-flow/message/presentation/components/ImageLightbox.vue";
import { addFiles as addImageFiles, addFiles } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";
import { createLogger } from "@/shared/utils/logger";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import SearchPanel from "@/features/chat/presentation/patchbay/components/search/SearchPanel.vue";
import AnnouncementBanner from "@/features/chat/presentation/channel-info/AnnouncementBanner.vue";
import ShortcutHelp from "@/features/chat/presentation/patchbay/components/help/ShortcutHelp.vue";
import type { ShortcutBinding } from "@/features/chat/presentation/patchbay/interactions/usePatchbayHotkeys";

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
  /**
   * 快捷键帮助面板可见性。
   */
  shortcutHelpVisible?: boolean;
  /**
   * 快捷键绑定列表（供帮助面板展示）。
   */
  shortcutBindings?: ShortcutBinding[];
  /**
   * 关闭快捷键帮助面板。
   */
  onCloseShortcutHelp?: () => void;
}>();

const { t } = useI18n();
const router = useRouter();
const logger = createLogger("ChatCenter");

/** 频道公告已被用户关闭。 */
const dismissedAnnouncement = ref(false);

/** 当前频道 id，用于在切换时重置公告关闭状态。 */
const previousChannelId = ref(props.model.currentChannelId);

/** 频道切换时重置公告关闭状态。 */
watch(() => props.model.currentChannelId, (newId, oldId) => {
  if (newId !== oldId) {
    dismissedAnnouncement.value = false;
    previousChannelId.value = newId;
  }
});

/**
 * 当前频道摘要（从 channels 列表中匹配 currentChannelId）。
 */
const currentChannel = computed(() => {
  const cid = props.model.currentChannelId;
  if (!cid) return null;
  return props.channels.find((c) => c.id === cid) ?? null;
});

/** 当前频道公告（如果存在且未被关闭）。 */
const channelAnnouncement = computed(() => {
  if (dismissedAnnouncement.value) return null;
  return currentChannel.value?.announcement ?? null;
});

/** 语音录制上传状态。 */
const isUploadingVoice = ref(false);

/**
 * 处理语音录制完成事件：读取文件、转为 Blob、添加到附件列表。
 */
async function handleVoiceRecorded(payload: { filePath: string; durationMs: number; sizeBytes: number }): Promise<void> {
  isUploadingVoice.value = true;
  try {
    const base64 = await invoke<string>("read_file_base64", { path: payload.filePath });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "audio/wav" });
    const file = new File([blob], `voice-message-${Date.now()}.wav`, { type: "audio/wav" });
    addFiles([file]);
  } catch (e) {
    logger.error("Action: chat_voice_message_upload_failed", { error: String(e) });
  } finally {
    isUploadingVoice.value = false;
  }
}

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

const currentCallState = ref<CallState>("idle");

function onVoiceCallStateChange(state: CallState): void {
  currentCallState.value = state;
}

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

function handleStickerSelected(r: { fileId: string; shareKey: string }): void {
  props.model.handleFileUploaded(r);
  props.model.handleSend();
}

function handleStickerText(text: string): void {
  props.model.handleSend({ domain: "Core:Text", domainVersion: "1.0.0", data: { text } });
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

/** 搜索面板中当前高亮的结果索引。 */
const searchActiveIndex = ref(0);

/**
 * 处理搜索结果导航：根据索引打开对应消息。
 *
 * @param index - 搜索结果列表中的索引。
 */
function handleSearchNavigate(index: number): void {
  const isServer = props.model.searchScope === "server";
  const results = isServer
    ? props.model.searchState.serverResults
    : props.model.searchState.results;
  const result = results[index];
  if (result) {
    props.model.openSearchResult(result.message.id, isServer ? (result as any).channelId : undefined);
  }
}
</script>

<template>
  <ErrorBoundary>
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
      @stateChange="onVoiceCallStateChange"
    />

    <AnnouncementBanner
      v-if="channelAnnouncement"
      :announcement="channelAnnouncement"
      @view-detail="router.push('/channel-info')"
      @dismiss="dismissedAnnouncement = true"
    />

    <SearchPanel
      v-if="props.model.searchPanelOpen"
      :visible="props.model.searchPanelOpen"
      :loading="props.model.searchState.loading"
      :error="props.model.searchState.error || null"
      :results="props.model.searchScope === 'server' ? props.model.searchState.serverResults : props.model.searchState.results"
      :active-index="searchActiveIndex"
      :query="props.model.searchState.query"
      :scope="props.model.searchScope"
      @search="(q: string) => props.model.searchMessages(q)"
      @update:scope="(s: 'channel' | 'server') => props.model.setSearchScope(s)"
      @navigate="handleSearchNavigate"
      @close="props.model.closeSearchPanel"
    />

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
              @retry="(mid: string) => logger.warn('Action: chat_retry_message not yet implemented', { messageId: mid })"
              @remove="(mid: string) => logger.warn('Action: chat_remove_message not yet implemented', { messageId: mid })"
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
        <VoiceMessageRecorder
          :disabled="isUploadingVoice"
          @recorded="handleVoiceRecorded"
          @error="(msg) => logger.error('Action: chat_voice_message_recorder_error', { error: msg })"
        />
        <FileUploadButton @uploaded="props.model.handleFileUploaded" @error="props.model.handleFileUploadError" />
        <StickerPickerButton
          :current-user-id="props.model.currentUserId"
          @sticker="handleStickerSelected"
          @send-text="handleStickerText"
        />
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

    <ShortcutHelp
      :visible="!!props.shortcutHelpVisible"
      :bindings="props.shortcutBindings || []"
      @close="props.onCloseShortcutHelp?.()"
    />
  </section>
  </ErrorBoundary>
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
