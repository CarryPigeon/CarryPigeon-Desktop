<script setup lang="ts">
/**
 * @fileoverview ChatCenter.vue
 * @description Patchbay 中央消息区：顶部状态、消息流、编辑器。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { ChatCenterModel } from "@/features/chat/presentation/patchbay/view-models/useChatCenterModel";
import ConnectionPill from "@/shared/ui/ConnectionPill.vue";
import AvatarBadge from "@/shared/ui/AvatarBadge.vue";
import UserProfilePopover from "@/features/account/profile/presentation/components/UserProfilePopover.vue";
import SignalStrip from "@/features/chat/message-flow/message/presentation/components/SignalStrip.vue";
import MessageContentHost from "@/features/chat/message-flow/message/presentation/components/MessageContentHost.vue";
import FileUploadButton from "@/features/chat/message-flow/upload/presentation/components/FileUploadButton.vue";
import ComposerHost from "@/features/chat/presentation/patchbay/components/composer/ComposerHost.vue";

const props = defineProps<{
  model: ChatCenterModel;
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
  <section class="cp-center">
    <header class="cp-topConsole">
      <div class="cp-topConsole__left">
        <div class="cp-topConsole__title">Messages</div>
      </div>
      <div class="cp-topConsole__right">
        <button
          v-if="props.model.currentChannelId"
          class="cp-topConsole__settings"
          type="button"
          @click="props.onOpenChannelSettingsMenu"
          :title="t('channel_settings')"
        >
          ⚙
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
        <div v-if="isUnreadStart" class="cp-unreadSep" role="separator" aria-label="unread boundary">UNREAD</div>
        <!-- 区块：消息行 -->
        <div
          class="cp-msg"
          :data-mine="m.from.id === props.model.currentUserId"
          :data-group-start="isGroupStart"
          tabindex="0"
          role="article"
          :aria-label="`message ${m.domain.label} from ${m.from.name}`"
          @contextmenu="props.onMessageContextMenu($event, m.id)"
          @keydown="props.model.handleMessageKeydown($event, m.id)"
        >
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
              <button class="cp-msg__more" type="button" aria-label="More actions" @click="props.onMoreClick($event, m.id)">⋯</button>
            </div>

            <!-- 区块：消息内容渲染宿主（core/plugin/unknown 分发） -->
            <MessageContentHost
              :message="m"
              :reply-text="m.replyToId ? props.model.formatReplyMiniText(props.model.currentChannelId, m.replyToId) : ''"
              :domain-registry-store="props.model.domainRegistryStore"
              @install="props.onInstallHint"
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
        @update:domainId="props.model.setDomainId"
        @update:draft="props.model.setDraft"
        @send="props.model.handleSend"
        @cancelReply="props.model.handleCancelReply"
      />
    </div>
  </section>
</template>
