<script setup lang="ts">
/**
 * @fileoverview ChatCenter.vue
 * @description Patchbay 中央消息区：顶部状态、消息流、编辑器。
 */

import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from "vue";
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
import SkeletonBlock from "@/shared/ui/SkeletonBlock.vue";
const ImageLightbox = defineAsyncComponent({
  loader: () => import("@/features/chat/message-flow/message/presentation/components/ImageLightbox.vue"),
  loadingComponent: SkeletonBlock,
  delay: 150,
  timeout: 15000,
});
import { addFiles as addImageFiles, addFiles } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";
import { createLogger } from "@/shared/utils/logger";
import ErrorBoundary from "@/shared/ui/ErrorBoundary.vue";
import SkeletonMessageList from "@/shared/ui/SkeletonMessageList.vue";
import SearchPanel from "@/features/chat/presentation/patchbay/components/search/SearchPanel.vue";
import AnnouncementBanner from "@/features/chat/presentation/channel-info/AnnouncementBanner.vue";
import PinListBar from "@/features/chat/presentation/patchbay/components/layout/PinListBar.vue";
import ShortcutHelp from "@/features/chat/presentation/patchbay/components/help/ShortcutHelp.vue";
import type { ShortcutBinding } from "@/features/chat/presentation/patchbay/interactions/usePatchbayHotkeys";
import { useVirtualizer } from '@tanstack/vue-virtual';

/**
 * 虚拟滚动项目类型。
 */
interface VirtualListItem {
  kind: 'message' | 'separator';
  key: string;
  /** 消息数据（仅在 kind='message' 时有值） */
  m?: any;
  isGroupStart?: boolean;
}

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

/**
 * 将 messageRows 展平为虚拟滚动可消费的平坦列表。
 * 每个原始消息行要么是普通消息，要么可能在此之前插入一条未读分隔符。
 */
const virtualListItems = computed<VirtualListItem[]>(() => {
  const items: VirtualListItem[] = [];
  const rows = props.model.messageRows;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.isUnreadStart) {
      items.push({ kind: 'separator', key: `sep-${row.m.id}` });
    }
    items.push({ kind: 'message', key: row.m.id, m: row.m, isGroupStart: row.isGroupStart });
  }
  return items;
});

/** @tanstack/vue-virtual 虚拟滚动实例。 */
const virtualizerOptions = computed(() => ({
  count: virtualListItems.value.length,
  getScrollElement: () => signalPaneEl.value,
  estimateSize: (index: number) => {
    const item = virtualListItems.value[index];
    if (!item || item.kind === 'separator') return 36;
    const m = item.m;
    if (!m) return 52;
    if (m.kind === 'image' || m.kind === 'video') return 220;
    let base = item.isGroupStart ? 52 : 32;
    if (m.replyToId) base += 28;
    if (m.reactions && m.reactions.length > 0) base += 24;
    if (m.threadReplyCount) base += 20;
    return base;
  },
  overscan: 10,
}));

const virtualizer = useVirtualizer(virtualizerOptions);

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
  startVideoCall: (targetUserId?: string) => Promise<void>;
  startConference: () => Promise<unknown>;
} | null>(null);

const currentCallState = ref<CallState>("idle");

function onVoiceCallStateChange(state: CallState): void {
  currentCallState.value = state;
}

/** 图片灯箱状态。 */
const lightboxOpen = ref(false);
const lightboxImages = ref<{ url: string; fileName: string; isVideo?: boolean; messageId?: string }[]>([]);
const lightboxIndex = ref(0);
/** 灯箱会话 key：每次打开递增，强制重建 ErrorBoundary + ImageLightbox 子树，避免残留错误状态。 */
const lightboxSessionKey = ref(0);

/** 媒体消息缓存（预计算，避免 openLightbox 每次 O(n) 扫描）。 */
const lightboxMediaCache = computed(() =>
  props.model.messageRows
    .filter((row) => (row.m.kind === "image" || row.m.kind === "video") && (row.m as any).url)
    .map((row) => {
      const m = row.m as Extract<typeof row.m, { kind: "image" | "video" }>;
      return { url: m.url, fileName: m.fileName, isVideo: m.kind === "video", messageId: m.id };
    }),
);

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
 * 收集当前频道内所有图片消息，支持在灯箱中前后翻页浏览。
 *
 * @param payload - 包含图片 URL 和文件名的对象。
 */
function openLightbox(payload: { url: string; fileName: string; isVideo?: boolean }): void {
  const allImages: { url: string; fileName: string; isVideo?: boolean; messageId?: string }[] = [...lightboxMediaCache.value];
  // 按 URL 查找点击的媒体在缓存中的索引。
  // 重复 URL 时取首个匹配项 —— 灯箱内按全频道媒体序列导航，重复项位置等价。
  let clickedIndex = allImages.findIndex((img) => img.url === payload.url);

  // 如果没找到匹配的图片（可能来自 thumbUrl 或附件 blob URL），至少包含当前点击的图片
  if (clickedIndex === -1) {
    clickedIndex = allImages.length;
    allImages.push({ url: payload.url, fileName: payload.fileName, isVideo: payload.isVideo });
  }

  lightboxImages.value = allImages;
  lightboxIndex.value = clickedIndex;
  lightboxSessionKey.value++;
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

function handleVideoCallStart(targetUserId: string): void {
  voiceHostRef.value?.startVideoCall(targetUserId || props.targetUserId || "");
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

/**
 * 重试发送失败的消息。
 *
 * @param messageId - 失败的消息 ID。
 */
function handleRetryMessage(messageId: string): void {
  const row = props.model.messageRows.find((r) => r.m.id === messageId);
  if (!row) return;
  const msg = row.m;
  // Reconstruct send payload from the failed message
  if (msg.kind === "image" || msg.kind === "video") {
    props.model.handleSend({
      domain: msg.domain.id,
      domainVersion: msg.domain.version || "1.0.0",
      data: {
        text: `[file:${msg.fileKey}]`,
        attachments: [{
          shareKey: msg.fileKey,
          name: msg.fileName,
          size: msg.fileSize,
          mimeType: msg.mimeType,
          width: msg.width,
          height: msg.height,
          ...(msg.kind === "video" && msg.duration ? { duration: msg.duration } : {}),
        }],
      },
    });
  } else if (msg.kind === "core_text") {
    props.model.handleSend({
      domain: msg.domain.id,
      domainVersion: msg.domain.version || "1.0.0",
      data: { text: msg.text },
    });
  }
  logger.info("Action: chat_retry_send_message", { messageId });
}

/**
 * 移除发送失败的消息。
 *
 * @param messageId - 失败的消息 ID。
 */
function handleRemoveFailedMessage(messageId: string): void {
  props.model.toggleMessageSelection(messageId);
  void props.model.handleBatchDelete();
  logger.info("Action: chat_remove_failed_message", { messageId });
}

/** 将 retry/remove 方法代理到 model 上，供模板直接调用。 */
const retryMessage = handleRetryMessage;
const removeFailedMessage = handleRemoveFailedMessage;
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
          @start-video="handleVideoCallStart"
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
          aria-live="polite"
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

    <PinListBar
      v-if="!props.model.pinsDismissed"
      :pins="props.model.pins"
      :loading="props.model.pinsLoading"
      :error="props.model.pinsError"
      @select="(messageId: string) => props.model.selectPinnedMessage(messageId)"
      @dismiss="props.model.dismissPins()"
      @unpin="(messageId: string) => props.model.unpinFromBar(messageId)"
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
      <!-- 区块：空状态（无频道选中） -->
      <div v-if="!props.model.currentChannelId" class="cp-emptyState">
        <div class="cp-emptyState__icon">💬</div>
        <div class="cp-emptyState__title">{{ t("select_channel") }}</div>
      </div>

      <!-- 区块：加载骨架（频道已选中、消息加载中） -->
      <SkeletonMessageList v-else-if="virtualListItems.length === 0 && !props.model.currentChannelHasMore" />

      <!-- 区块：空状态（消息已加载但无消息） -->
      <div v-else-if="virtualListItems.length === 0 && !props.model.loadingMoreMessages" class="cp-emptyState">
        <div class="cp-emptyState__icon">📭</div>
        <div class="cp-emptyState__title">{{ t("no_messages") }}</div>
        <div class="cp-emptyState__desc">{{ t("no_messages_hint") }}</div>
      </div>

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

      <!-- 区块：虚拟滚动消息列表（@tanstack/vue-virtual），仅渲染视口附近项目 -->
      <div :style="{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }">
        <div
          v-for="vr in virtualizer.getVirtualItems()"
          :key="String(vr.key)"
          :data-index="vr.index"
          :ref="(el: unknown) => { if (el && (el as Element).parentNode) virtualizer.measureElement(el as Element); }"
          :style="{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vr.start}px)` }"
        >
          <!-- 未读边界 -->
          <div v-if="virtualListItems[vr.index]?.kind === 'separator'" class="cp-unreadSep" role="separator" :aria-label="t('unread')">{{ t("unread") }}</div>
          <!-- 区块：消息行 -->
          <template v-else-if="virtualListItems[vr.index]?.kind === 'message'">
            <div
              class="cp-msg"
              :data-message-id="virtualListItems[vr.index].m.id"
              :data-highlighted="virtualListItems[vr.index].m.id === props.model.highlightedMessageId"
              :data-editing="virtualListItems[vr.index].m.id === props.editingMessageId"
              :data-mine="virtualListItems[vr.index].m.from.id === props.model.currentUserId"
              :data-group-start="virtualListItems[vr.index].isGroupStart"
              :data-mentioned="props.model.isMentioned(virtualListItems[vr.index].m)"
              tabindex="0"
              role="article"
              :aria-label="`message ${virtualListItems[vr.index].m.domain.label} from ${virtualListItems[vr.index].m.from.name}`"
              @contextmenu="!virtualListItems[vr.index].m.recalledAt && props.onMessageContextMenu($event, virtualListItems[vr.index].m.id)"
              @keydown="props.model.handleMessageKeydown($event, virtualListItems[vr.index].m.id)"
            >
              <!-- 区块：多选复选框 -->
              <div v-if="props.model.multiSelectMode" class="cp-msg__checkbox">
                <input
                  type="checkbox"
                  :checked="props.model.isMessageSelected(virtualListItems[vr.index].m.id)"
                  @change="props.model.toggleMessageSelection(virtualListItems[vr.index].m.id)"
                />
              </div>
              <!-- 区块：头像列（仅 group-start 可见） -->
              <div class="cp-msg__avatar" :data-visible="virtualListItems[vr.index].isGroupStart">
                <UserProfilePopover
                  :user-id="virtualListItems[vr.index].m.from.id"
                  :username="virtualListItems[vr.index].m.from.name"
                  trigger="hover"
                >
                  <AvatarBadge :name="virtualListItems[vr.index].m.from.name" :avatar-url="virtualListItems[vr.index].m.from.avatarUrl" :size="28" />
                </UserProfilePopover>
              </div>
              <!-- 区块：domain 色条列 -->
              <div class="cp-msg__strip">
                <SignalStrip :color-var="virtualListItems[vr.index].m.domain.colorVar" />
              </div>
              <!-- 区块：内容列（meta + bubble/card） -->
              <div class="cp-msg__body">
                <!-- 区块：meta 行 -->
                <div class="cp-msg__meta" :data-compact="!virtualListItems[vr.index].isGroupStart">
                  <span v-if="virtualListItems[vr.index].isGroupStart" class="cp-msg__from">{{ virtualListItems[vr.index].m.from.name }}</span>
                  <span class="cp-msg__dot"></span>
                  <span class="cp-msg__time">{{ props.model.fmtTime(virtualListItems[vr.index].m.timeMs) }}</span>
                  <span class="cp-msg__dot"></span>
                  <span class="cp-msg__domain">{{ virtualListItems[vr.index].m.domain.label }}</span>
                  <button v-if="!virtualListItems[vr.index].m.recalledAt" class="cp-msg__more" type="button" :aria-label="t('more_actions')" @click="props.onMoreClick($event, virtualListItems[vr.index].m.id)">⋯</button>
                </div>

                <!-- 区块：消息内容渲染宿主（core/plugin/unknown 分发） -->
                <MessageContentHost
                  :message="virtualListItems[vr.index].m"
                  :reply-text="virtualListItems[vr.index].m.replyToId ? props.model.formatReplyMiniText(props.model.currentChannelId, virtualListItems[vr.index].m.replyToId) : ''"
                  :domain-registry-store="props.model.domainRegistryStore"
                  :editing-message-id="props.editingMessageId"
                  @install="props.onInstallHint"
                  @react="(messageId, emoji) => emoji && reactToMessage(messageId, emoji)"
                  @edit="(payload) => props.onEdit?.(payload.messageId, payload.text)"
                  @edit-cancel="props.onEditCancel?.()"
                  @openLightbox="openLightbox"
                  @viewThread="(messageId) => props.onViewThread?.(messageId)"
                  @viewForwardDetail="openForwardDetail"
                  @retry="(mid: string) => retryMessage(mid)"
                  @remove="(mid: string) => removeFailedMessage(mid)"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

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
        <FileUploadButton @error="props.model.handleFileUploadError" />
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
        @openLightbox="openLightbox"
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

    <ErrorBoundary :key="lightboxSessionKey">
      <ImageLightbox
        v-if="lightboxOpen"
        :images="lightboxImages"
        :initial-index="lightboxIndex"
        @close="closeLightbox"
      />
    </ErrorBoundary>

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
.cp-msg[data-editing="true"] {
  background: color-mix(in oklab, var(--cp-accent, #5865f2) 8%, transparent);
  border-radius: 14px;
  outline: 1.5px dashed var(--cp-accent, #5865f2);
  outline-offset: -1.5px;
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

/* 空状态 */
.cp-emptyState {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 24px;
  text-align: center;
  min-height: 200px;
}

.cp-emptyState__icon {
  font-size: 40px;
  line-height: 1;
  opacity: 0.6;
}

.cp-emptyState__title {
  font-size: 15px;
  font-weight: 600;
  color: var(--cp-text);
}

.cp-emptyState__desc {
  font-size: 13px;
  color: var(--cp-text-muted);
  max-width: 280px;
}
</style>
