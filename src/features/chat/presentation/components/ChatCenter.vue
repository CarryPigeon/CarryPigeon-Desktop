<script setup lang="ts">
/**
 * @fileoverview ChatCenter.vue
 * @description Patchbay 中央消息区：顶部状态、消息流、编辑器。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { connectionDetail, connectionPillState, retryLast } from "@/features/network/api";
import {
  availableDomains,
  composerDraft,
  currentChannelHasMore,
  currentChannelId,
  currentChannelLastReadTimeMs,
  currentMessages,
  getMessageById,
  loadMoreMessages,
  loadingMoreMessages,
  replyToMessageId,
  selectedDomainId,
  sendComposerMessage,
  sendError,
  cancelReply,
  type ChatMessage,
} from "@/features/chat/presentation/store/chatStore";
import { FileUploadButton } from "@/features/files/api";
import { currentUser } from "@/features/user/api";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import SignalStrip from "@/features/chat/presentation/components/messages/SignalStrip.vue";
import UnknownDomainCard from "@/features/chat/presentation/components/messages/UnknownDomainCard.vue";
import ComposerHost from "@/features/chat/presentation/components/inputs/ComposerHost.vue";
import CoreTextBubble from "@/features/chat/presentation/components/messages/CoreTextBubble.vue";

type MessageRow = {
  m: ChatMessage;
  isGroupStart: boolean;
  isUnreadStart: boolean;
};

type DomainRegistryStoreLike = {
  bindingByDomain: Record<
    string,
    {
      pluginId: string;
      composer?: unknown;
      renderer?: unknown;
    }
  >;
  getContextForPlugin(pluginId: string): unknown;
  getContextForDomain(domainId: string): unknown;
};

const props = defineProps<{
  /**
   * 是否展示“跳到底部”按钮。
   */
  showJumpToBottom: boolean;
  /**
   * 点击“跳到底部”的处理。
   */
  onJumpToBottom: () => void;
  /**
   * 滚动事件处理（由父级负责读取 signalPaneRef 并编排自动加载）。
   */
  onSignalScroll: () => void;
  /**
   * 用户点击“加载更早消息”的处理。
   */
  onLoadMoreMessages: () => void | Promise<void>;
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
   * 键盘快捷：回复当前聚焦消息。
   */
  onReplyShortcut: (messageId: string) => void;
  /**
   * 键盘快捷：删除当前聚焦消息（权限由上游校验）。
   */
  onDeleteShortcut: (messageId: string) => void;
  /**
   * domain registry store（来自父级，按 socket scope 解析）。
   *
   * 说明：该 store 由父级按 socket scope 解析后传入。
   */
  domainRegistryStore: unknown;
}>();

const { t } = useI18n();
const signalPaneEl = ref<HTMLElement | null>(null);
const domainRegistryStore = computed<DomainRegistryStoreLike>(() => props.domainRegistryStore as DomainRegistryStoreLike);

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

/**
 * 解析当前所选 domain 对应的插件编辑器组件（composer）。
 */
const activePluginComposer = computed(() => {
  const store = domainRegistryStore.value;
  return store?.bindingByDomain?.[selectedDomainId.value]?.composer ?? null;
});

/**
 * 解析当前编辑器对应的插件上下文（每次访问重新生成，避免跨频道/跨 socket 污染）。
 */
const activePluginContext = computed(() => {
  const store = domainRegistryStore.value;
  const binding = store?.bindingByDomain?.[selectedDomainId.value] ?? null;
  if (!binding) return null;
  return store.getContextForPlugin(binding.pluginId);
});

/**
 * 构造 `ComposerHost` 的 domain 下拉选项。
 */
const domainOptions = computed<Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }>>(() => {
  const out: Array<{ id: string; label: string; colorVar: ChatMessage["domain"]["colorVar"] }> = [];
  for (const d of availableDomains()) out.push({ id: d.id, label: d.label, colorVar: d.colorVar });
  return out;
});

/**
 * 格式化消息 meta 行展示的时间戳。
 *
 * @param ms - 毫秒级时间戳（epoch ms）。
 * @returns 本地化的短时间字符串（HH:MM）。
 */
function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * 格式化消息气泡内的“引用预览”（from: snippet）。
 *
 * @param channelId - 当前频道 id。
 * @param replyToId - 被引用的消息 id。
 * @returns 简短的 `from: snippet` 文本；缺失/被删时返回 "—"。
 */
function formatReplyMiniText(channelId: string, replyToId: string): string {
  const r = getMessageById(channelId, replyToId);
  if (!r) return "—";
  const snippet = r.kind === "core_text" ? r.text : r.preview;
  return `${r.from.name}: ${snippet}`;
}

/**
 * 计算消息列表的视图模型行（view-model rows）。
 */
const messageRows = computed<MessageRow[]>(() => {
  const list = currentMessages.value;
  const lastRead = currentChannelLastReadTimeMs.value;
  const rows: MessageRow[] = [];

  for (let idx = 0; idx < list.length; idx += 1) {
    const m = list[idx];
    const prev = idx > 0 ? list[idx - 1] : null;
    let sameSender = false;
    let closeInTime = false;
    if (prev) {
      sameSender = prev.from.id === m.from.id;
      closeInTime = Math.abs(m.timeMs - prev.timeMs) < 1000 * 90;
    }
    const isGroupStart = !(sameSender && closeInTime);
    const isUnreadStart = m.timeMs > lastRead && (!prev || prev.timeMs <= lastRead);
    rows.push({ m, isGroupStart, isUnreadStart });
  }

  return rows;
});

/**
 * 计算当前“回复预览”（显示在编辑器上方）。
 */
const replyPreview = computed<{ title: string; snippet: string }>(() => {
  const id = replyToMessageId.value;
  if (!id) return { title: "", snippet: "" };
  const msg = getMessageById(currentChannelId.value, id);
  if (!msg) return { title: "Reply", snippet: "Message not found" };
  const snippet = msg.kind === "core_text" ? msg.text : msg.preview;
  return { title: `Reply → ${msg.from.name}`, snippet };
});

/**
 * 当前用户 id（用于 `data-mine` 标记）。
 */
const currentUserId = computed(() => String(currentUser.id || "u-1"));

/**
 * 更新编辑器的 domain 选择。
 *
 * @param v - domain id（例如 `Core:Text`）。
 * @returns 无返回值。
 */
function setDomainId(v: string): void {
  selectedDomainId.value = v;
}

/**
 * 更新当前编辑器草稿文本。
 *
 * @param v - 新的草稿文本。
 * @returns 无返回值。
 */
function setDraft(v: string): void {
  composerDraft.value = v;
}

/**
 * 从编辑器退出回复模式。
 */
function handleCancelReply(): void {
  cancelReply();
}

/**
 * 处理文件上传成功：将分享 key 以 token 的方式写入草稿。
 *
 * @param result - 上传结果。
 * @returns 无返回值。
 */
function handleFileUploaded(result: { fileId: string; shareKey: string }): void {
  const text = composerDraft.value;
  composerDraft.value = text ? `${text}\n[file:${result.shareKey}]` : `[file:${result.shareKey}]`;
}

/**
 * 处理文件上传失败：将错误写入发送错误提示。
 *
 * @param error - 错误信息。
 * @returns 无返回值。
 */
function handleFileUploadError(error: string): void {
  sendError.value = error;
}

/**
 * 兜底：当 store 未提供 loadMore 的时候避免点击报错（保持 UI 可用）。
 *
 * @returns 无返回值。
 */
async function safeLoadMore(): Promise<void> {
  if (typeof props.onLoadMoreMessages === "function") {
    await props.onLoadMoreMessages();
    return;
  }
  await loadMoreMessages();
}

/**
 * 处理消息行键盘快捷键。
 *
 * 规则：
 * - `R`：回复消息；
 * - `Delete`：删除消息；
 * - `Shift+F10` 或 `ContextMenu`：打开上下文菜单。
 *
 * @param e - 键盘事件。
 * @param messageId - 目标消息 id。
 * @returns 无返回值。
 */
function handleMessageKeydown(e: KeyboardEvent, messageId: string): void {
  if (e.key === "Delete") {
    e.preventDefault();
    props.onDeleteShortcut(messageId);
    return;
  }

  const k = e.key.toLowerCase();
  if (!e.metaKey && !e.ctrlKey && !e.altKey && k === "r") {
    e.preventDefault();
    props.onReplyShortcut(messageId);
    return;
  }

  const openContext = (e.shiftKey && e.key === "F10") || e.key === "ContextMenu";
  if (!openContext) return;

  e.preventDefault();
  const target = e.currentTarget as HTMLElement | null;
  const rect = target?.getBoundingClientRect();
  const x = Math.trunc((rect?.left ?? 0) + 20);
  const y = Math.trunc((rect?.top ?? 0) + 20);
  props.onMessageContextMenu(new MouseEvent("contextmenu", { bubbles: true, clientX: x, clientY: y }), messageId);
}
</script>

<template>
  <!-- 组件：ChatCenter｜职责：中央消息区（header / signal pane / composer） -->
  <!-- 区块：<section> .cp-center -->
  <section class="cp-center">
    <header class="cp-topConsole">
      <div class="cp-topConsole__left">
        <div class="cp-topConsole__title">SIGNAL FLOW</div>
        <div class="cp-topConsole__hint">Ctrl/Cmd+K · Ctrl/Cmd+P · Ctrl/Cmd+,</div>
      </div>
      <div class="cp-topConsole__right">
        <button
          v-if="currentChannelId"
          class="cp-topConsole__settings"
          type="button"
          @click="props.onOpenChannelSettingsMenu"
          :title="t('channel_settings')"
        >
          ⚙
        </button>
        <ConnectionPill
          :state="connectionPillState"
          label="Link"
          :detail="connectionDetail"
          :action-label="connectionPillState === 'offline' ? 'Retry' : ''"
          @action="retryLast"
        />
      </div>
    </header>

    <div ref="signalPaneEl" class="cp-signalPane" role="log" aria-label="messages" aria-live="polite" @scroll="props.onSignalScroll">
      <!-- 区块：游标分页（加载更早历史） -->
      <div v-if="currentChannelHasMore" class="cp-historyMore">
        <button
          class="cp-historyMore__btn"
          type="button"
          :disabled="loadingMoreMessages"
          @click="safeLoadMore"
        >
          {{ loadingMoreMessages ? t("loading") : t("load_older") }}
        </button>
      </div>

      <!-- 区块：消息列表（包含基于 last_read_time 的“UNREAD”分隔符，mock 逻辑） -->
      <template v-for="{ m, isGroupStart, isUnreadStart } in messageRows" :key="m.id">
        <!-- 区块：未读边界 -->
        <div v-if="isUnreadStart" class="cp-unreadSep" role="separator" aria-label="unread boundary">UNREAD</div>
        <!-- 区块：消息行 -->
        <div
          class="cp-msg"
          :data-mine="m.from.id === currentUserId"
          :data-group-start="isGroupStart"
          tabindex="0"
          role="article"
          :aria-label="`message ${m.domain.label} from ${m.from.name}`"
          @contextmenu="props.onMessageContextMenu($event, m.id)"
          @keydown="handleMessageKeydown($event, m.id)"
        >
          <!-- 区块：头像列（仅 group-start 可见；预留空间用于对齐） -->
          <div class="cp-msg__avatar" :data-visible="isGroupStart">
            <AvatarBadge :name="m.from.name" :size="28" />
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
              <span class="cp-msg__time">{{ fmtTime(m.timeMs) }}</span>
              <span class="cp-msg__dot"></span>
              <span class="cp-msg__domain">{{ m.domain.label }}</span>
              <button class="cp-msg__more" type="button" aria-label="More actions" @click="props.onMoreClick($event, m.id)">⋯</button>
            </div>

            <!-- 区块：核心文本气泡（Core:Text） -->
            <CoreTextBubble
              v-if="m.kind === 'core_text'"
              :message-id="m.id"
              :text="m.text"
              :reply-text="m.replyToId ? formatReplyMiniText(currentChannelId, m.replyToId) : ''"
            />
            <!-- 区块：插件渲染（domain 已注册且存在 renderer 时） -->
            <div
              v-else-if="m.kind === 'domain_message' && domainRegistryStore.bindingByDomain[m.domain.id]?.renderer"
              class="cp-pluginBubble"
            >
              <component
                :is="domainRegistryStore.bindingByDomain[m.domain.id].renderer"
                :context="domainRegistryStore.getContextForDomain(m.domain.id)"
                :data="m.data"
                :preview="m.preview"
                :domain="m.domain.id"
                :domainVersion="m.domain.version || ''"
                :mid="m.id"
                :from="m.from"
                :timeMs="m.timeMs"
                :replyToMid="m.replyToId"
              />
            </div>
            <!-- 区块：未知 domain 降级卡片 -->
            <UnknownDomainCard
              v-else
              :domain-id="m.domain.id"
              :domain-version="m.domain.version || ''"
              :plugin-id-hint="m.domain.pluginIdHint || ''"
              :preview="m.preview"
              @install="props.onInstallHint(m.domain.pluginIdHint)"
            />
          </div>
        </div>
      </template>

      <button
        v-if="props.showJumpToBottom"
        class="cp-jumpBottom"
        type="button"
        aria-label="Jump to bottom"
        title="Jump to bottom"
        @click="props.onJumpToBottom"
      >
        ↓
      </button>
    </div>

    <div class="cp-composerPane">
      <div class="cp-composerActions">
        <FileUploadButton @uploaded="handleFileUploaded" @error="handleFileUploadError" />
      </div>
      <ComposerHost
        :domain-id="selectedDomainId"
        :domain-options="domainOptions"
        :draft="composerDraft"
        :reply-title="replyPreview.title"
        :reply-snippet="replyPreview.snippet"
        :reply-to-mid="replyToMessageId"
        :error="sendError"
        :plugin-composer="activePluginComposer"
        :plugin-context="activePluginContext"
        @update:domainId="setDomainId"
        @update:draft="setDraft"
        @send="sendComposerMessage"
        @cancelReply="handleCancelReply"
      />
    </div>
  </section>
</template>
