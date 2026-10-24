<script setup lang="ts">
/**
 * @fileoverview ComposerHost.vue
 * @description chat｜组件：ComposerHost。
 */

import { computed, ref, type Component, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { safeListen } from "@/shared/tauri/events";
import type { UnlistenFn } from "@tauri-apps/api/event";
import DomainSelector from "./DomainSelector.vue";
import { ScreenshotButton } from "@/features/screenshot/components";
import StickerPickerButton from "@/features/chat/presentation/patchbay/components/composer/StickerPickerButton.vue";
import FileUploadButton from "@/features/chat/message-flow/upload/presentation/components/FileUploadButton.vue";
import VoiceMessageRecorder from "@/features/chat/message-flow/message/presentation/components/VoiceMessageRecorder.vue";
import LinkPreviewCard from "./LinkPreviewCard.vue";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";
import type { ComposerSubmitPayload } from "@/features/chat/message-flow/api-types";
import AttachmentPreviewBar from "@/features/chat/message-flow/upload/presentation/components/AttachmentPreviewBar.vue";
import { addFiles, getAttachments, removeAttachment } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";
import { getMessageFlowCapabilities } from "@/features/chat/message-flow/api";
import { createLogger } from "@/shared/utils/logger";
import { readLocalFileAsBlob } from "@/shared/utils/readLocalFileAsBlob";
import AppIcon from "@/shared/ui/AppIcon.vue";

const props = defineProps<{
  domainId: string;
  domainOptions: Array<{ id: string; label: string; colorVar: string }>;
  draft: string;
  replyTitle?: string;
  replySnippet?: string;
  replyToMid?: string;
  error?: string;
  sending?: boolean;
  disabled?: boolean;
  pluginComposer?: Component | null;
  pluginContext?: unknown;
  mentionCandidates?: Array<{ userId: string; displayName: string; avatar?: string }>;
  mentionMenuOpen?: boolean;
  currentUserRole?: string;
  currentUserId: string;
  quoteReplyDraft?: { messageId: string; userId: string; preview: string } | null;
  linkPreview?: ChatLinkPreview | null;
}>();

const emit = defineEmits<{
  (e: "update:domainId", v: string): void;
  (e: "update:draft", v: string): void;
  (e: "send", payload?: ComposerSubmitPayload): void;
  (e: "cancelReply"): void;
  (e: "cancel-quote-reply"): void;
  (e: "mentionQuery", query: string): void;
  (e: "selectMention", mention: { userId: string; displayName: string; type?: "everyone" | "here" }): void;
  (e: "closeMentionMenu"): void;
  (e: "urlDetected", url: string): void;
  (e: "dismissLinkPreview"): void;
  (e: "sticker", payload: { fileId: string; shareKey: string }): void;
  (e: "send-text", text: string): void;
  (e: "file-upload-error", error: string): void;
  (e: "openLightbox", payload: { url: string; fileName: string; isVideo?: boolean }): void;
}>();

/**
 * 判断当前 domain 是否使用“插件作曲器（composer）”组件。
 *
 * @returns 需要挂载插件 composer UI 则为 `true`。
 */
function computeIsPluginComposerActive(): boolean {
  return Boolean(props.pluginComposer);
}

const isPluginComposerActive = computed(computeIsPluginComposerActive);

/**
 * 判断当前是否允许发送。
 *
 * 规则：
 * - Draft 至少包含一个非空白字符，或存在任意类型的待发送附件。
 *
 * @returns 允许发送则为 `true`。
 */
function computeCanSend(): boolean {
  if (isPluginComposerActive.value) return false;
  if (props.domainId.trim() !== "Core:Text") return false;
  const hasText = props.draft.trim().length > 0;
  // "done" 表示上传已完成（可发送），"pending" 表示等待上传。
  // 两者均视为"有待发送内容"，允许启用发送按钮。
  const hasPendingAttachments = attachments.value.some(
    (att) => att.status === "done" || att.status === "pending",
  );
  return hasText || hasPendingAttachments;
}

const canSend = computed(computeCanSend);
const { t } = useI18n();
const logger = createLogger("ComposerHost");

/**
 * 当前是否选中内置语音域（Core:Voice）。
 *
 * 语音与 Core:Text 同级：选中该域时，输入区渲染为语音录制面板，
 * 录制完成直接走发送流程；不再依赖工具栏常驻录音按钮。
 */
const isVoiceDomain = computed(() => props.domainId.trim() === "Core:Voice");

const domainExpanded = ref(false);
const isUploadingVoice = ref(false);

/** 附件列表快照（响应式）。 */
const attachments = computed(() => Array.from(getAttachments().values()));

const collapsed = ref(true);
const composerEl = ref<HTMLElement | null>(null);

const shouldBeExpanded = computed(() => {
  if (props.draft.trim().length > 0) return true;
  if (attachments.value.length > 0) return true;
  if (props.replyTitle || props.replySnippet) return true;
  if (props.quoteReplyDraft) return true;
  if (props.error) return true;
  return false;
});

let collapseTimer: ReturnType<typeof setTimeout> | null = null;

function expand(): void {
  if (collapseTimer) {
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }
  collapsed.value = false;
}

function scheduleCollapse(): void {
  if (shouldBeExpanded.value) return;
  if (collapseTimer) clearTimeout(collapseTimer);
  collapseTimer = setTimeout(() => {
    collapsed.value = true;
  }, 150);
}

function handleFocus(): void {
  expand();
}

function handleBlur(event?: FocusEvent): void {
  const related = event?.relatedTarget as Node | null;
  if (composerEl.value && related && composerEl.value.contains(related)) {
    // 焦点仍在 ComposerHost 内部移动，不触发折叠
    return;
  }
  scheduleCollapse();
}

function handleCollapsedClick(): void {
  expand();
  nextTick(() => {
    const textarea = composerEl.value?.querySelector("textarea");
    textarea?.focus();
  });
}

watch(
  shouldBeExpanded,
  (expanded) => {
    if (expanded) expand();
  },
  { immediate: true },
);

async function handleVoiceRecorded(payload: { filePath: string; durationMs: number; sizeBytes: number }): Promise<void> {
  isUploadingVoice.value = true;
  try {
    const blob = await readLocalFileAsBlob(payload.filePath, "audio/wav");
    const file = new File([blob], `voice-message-${Date.now()}.wav`, { type: "audio/wav" });
    const outcome = await getMessageFlowCapabilities().composer.sendVoiceMessage({
      file,
      durationMs: payload.durationMs,
    });
    if (!outcome.ok) {
      logger.error("Action: chat_voice_message_send_failed", {
        error: outcome.error.message,
        code: outcome.error.code,
      });
    }
  } catch (e) {
    logger.error("Action: chat_voice_message_upload_failed", { error: String(e) });
  } finally {
    isUploadingVoice.value = false;
  }
}

let unlistenScreenshot: UnlistenFn | null = null;

async function handleScreenshotCompleted(event: { payload: string }): Promise<void> {
  try {
    const blob = await readLocalFileAsBlob(event.payload, "image/png");
    const file = new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" });
    addFiles([file]);
  } catch (e) {
    logger.error("Action: chat_composer_screenshot_insert_failed", { error: String(e) });
  }
}

let mounted = true;

onMounted(() => {
  safeListen("screenshot-completed", handleScreenshotCompleted).then((unlisten) => {
    if (mounted) unlistenScreenshot = unlisten;
  });
});

onBeforeUnmount(() => {
  mounted = false;
  unlistenScreenshot?.();
  if (collapseTimer) clearTimeout(collapseTimer);
});

function handleStickerSelected(r: { fileId: string; shareKey: string }): void {
  emit("sticker", r);
}

function handleStickerText(text: string): void {
  emit("send-text", text);
}

/**
 * 处理粘贴事件：检测剪贴板中的文件并添加到附件列表。
 *
 * 支持任意类型文件：图片、视频、文档、压缩包等。
 * 仅在剪贴板中包含 `kind === 'file'` 的条目时才阻止默认粘贴行为。
 *
 * @param e - 原生剪贴板事件。
 */
function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items;
  if (!items) return;
  const pastedFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) pastedFiles.push(file);
    }
  }
  if (pastedFiles.length > 0) {
    e.preventDefault();
    addFiles(pastedFiles);
  }
}

/**
 * 重试上传失败的附件（重置为 pending 状态）。
 *
 * @param id - 附件 id。
 */
function handleRetryAttachment(id: string): void {
  const att = getAttachments().get(id);
  if (att) {
    att.status = "pending";
    att.error = undefined;
    att.progress = 0;
  }
}

/**
 * 触发发送请求（draft 为空或 sending 时会被禁用）。
 *
 * @returns 无返回值。
 */
function handleSend(): void {
  if (!canSend.value) return;
  emit("send");
}

/**
 * 统一处理键盘事件
 *
 * @param _ - 当前输入值
 * @param event - 事件对象（包含 e 属性为原生事件）
 * @returns 无返回值。
 */
function handleKeydown(_: string | number, event: { e: KeyboardEvent }): void {
  const { e } = event;

  // 处理 Shift+Enter：换行
  if (e.key === "Enter" && e.shiftKey) {
    // 不阻止默认行为，允许 textarea 换行
    return;
  }

  // 处理 Escape：优先关闭提及菜单；若输入为空则取消焦点并折叠
  if (e.key === "Escape") {
    if (props.mentionMenuOpen) {
      e.preventDefault();
      e.stopPropagation();
      emit("closeMentionMenu");
      return;
    }
    if (
      props.draft.trim().length === 0 &&
      attachments.value.length === 0 &&
      !props.replyTitle &&
      !props.replySnippet &&
      !props.quoteReplyDraft &&
      !props.error
    ) {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement | null)?.blur();
      scheduleCollapse();
    }
    return;
  }

  // 处理 Enter：发送
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    e.stopPropagation();

    if (!canSend.value) return; //确保不发送空信息

    handleSend();
    // 清空输入框
    emit("update:draft", "");
  }
}

/**
 * 接收插件 composer 的提交 payload，并转发给宿主。
 *
 * @param payload - 需要发送的插件 payload。
 * @returns 无返回值。
 */
function handlePluginSubmit(payload: ComposerSubmitPayload): void {
  emit("send", payload);
}

/**
 * 触发“取消回复”。
 *
 * @returns 无返回值。
 */
function handleCancelReply(): void {
  emit("cancelReply");
}

/**
 * DomainSelector 的 v-model 适配器。
 *
 * @param v - 选中的 domain id。
 * @returns 无返回值。
 */
function handleUpdateDomainId(v: string): void {
  emit("update:domainId", v);
}

/**
 * textarea draft 的 v-model 适配器。
 *
 * 同时检测 @ 触发提及菜单。
 *
 * @param v - 新的 draft 值。
 * @returns 无返回值。
 */
function handleUpdateDraft(v: string): void {
  emit("update:draft", v);
  const match = /(^|\s)@([^\s@]*)$/.exec(v);
  if (match) {
    emit("mentionQuery", match[2] ?? "");
  }
  const URL_RE = /https?:\/\/[^\s]+/;
  const urlMatch = URL_RE.exec(v);
  if (urlMatch && urlMatch[0]) {
    const url = urlMatch[0];
    emit("urlDetected", url);
  }
}

/**
 * 系统级提及列表：@everyone 和 @here。
 * 只有 admin/owner 角色的用户可以发送。
 */
const systemMentions = computed(() => {
  const items: Array<{ type: "everyone" | "here"; label: string; disabled: boolean }> = [];
  const isAdmin = props.currentUserRole === "admin" || props.currentUserRole === "owner";
  items.push({ type: "everyone", label: "@everyone", disabled: !isAdmin });
  items.push({ type: "here", label: "@here", disabled: !isAdmin });
  return items;
});

function selectSystemMention(type: "everyone" | "here"): void {
  emit("selectMention", { userId: type, displayName: type, type });
}

</script>

<template>
  <!-- 组件：ComposerHost｜职责：统一发送区（工具栏 + 输入 + 发送） -->
  <section ref="composerEl" class="cp-composer" :class="{ 'cp-composer--collapsed': collapsed }">
    <!-- 折叠态：占位输入条（常驻挂载，外层 grid 0fr↔1fr 高度过渡，与展开区交叉渐变） -->
    <div class="cp-composer__collapsedExpander" :data-open="collapsed">
      <div class="cp-composer__collapsedClip">
        <div
          class="cp-composer__collapsed"
          role="button"
          :tabindex="collapsed ? 0 : -1"
          :aria-hidden="!collapsed"
          :inert="!collapsed"
          :aria-label="t('message_input_placeholder')"
          @click="handleCollapsedClick"
          @focus="handleCollapsedClick"
        >
          <span class="cp-composer__collapsedPlaceholder">{{ t('message_input_placeholder') }}</span>
          <button class="cp-composer__send" type="button" disabled>{{ t('send') }}</button>
        </div>
      </div>
    </div>

    <!-- 展开态：常驻挂载；外层用 grid-template-rows 0fr↔1fr 做高度过渡，折叠时 inert 防误焦 -->
    <div class="cp-composer__expander" :data-open="!collapsed" :inert="collapsed">
      <div class="cp-composer__expandedClip">
    <!-- 展开态：完整编辑器 -->
    <div class="cp-composer__expanded" @focusin="expand" @focusout="handleBlur">
      <div v-if="props.replyTitle || props.replySnippet" class="cp-reply">
        <div class="cp-reply__left">
          <div class="cp-reply__title">{{ props.replyTitle || t("reply") }}</div>
          <div class="cp-reply__snippet">{{ props.replySnippet || "—" }}</div>
        </div>
        <button class="cp-reply__btn" type="button" :aria-label="t('close_reply')" @click="handleCancelReply"><AppIcon name="close" /></button>
      </div>

      <div v-if="props.quoteReplyDraft" class="cp-quoteBar">
        <div class="cp-quoteBar__bar"></div>
        <div class="cp-quoteBar__content">
          <span class="cp-quoteBar__label">{{ t("quoting") }}</span>
          <span class="cp-quoteBar__preview">{{ props.quoteReplyDraft.preview }}</span>
        </div>
        <button class="cp-quoteBar__close" type="button" :aria-label="t('close_quote')" @click="$emit('cancel-quote-reply')"><AppIcon name="close" /></button>
      </div>

      <div v-if="props.error" class="cp-composer__error" role="alert">
      {{ props.error }}
    </div>

    <!-- 工具栏行 -->
    <div class="cp-composer__toolbar">
      <DomainSelector
        :model-value="props.domainId"
        :options="props.domainOptions"
        :collapsed="true"
        @update:model-value="handleUpdateDomainId"
        @toggle-expand="domainExpanded = !domainExpanded"
      />
      <div class="cp-composer__tools">
        <StickerPickerButton
          :current-user-id="props.currentUserId"
          @sticker="handleStickerSelected"
          @send-text="handleStickerText"
        />
        <FileUploadButton @error="(err: string) => emit('file-upload-error', err)" />
        <ScreenshotButton />
      </div>
    </div>

    <!-- DomainSelector 展开行 -->
    <div v-if="domainExpanded" class="cp-composer__domainRow">
      <DomainSelector
        :model-value="props.domainId"
        :options="props.domainOptions"
        @update:model-value="(v: string) => { handleUpdateDomainId(v); domainExpanded = false; }"
      />
    </div>

    <!-- 输入区 + 附件预览 -->
    <div class="cp-composer__inputArea">
      <div v-if="isPluginComposerActive" class="cp-composer__plugin">
        <component
          :is="props.pluginComposer"
          :context="props.pluginContext"
          :replyToMid="props.replyToMid"
          :disabled="Boolean(props.disabled) || Boolean(props.sending)"
          @submit="handlePluginSubmit"
        />
      </div>
      <template v-else-if="isVoiceDomain">
        <!-- 语音域编辑器：录制面板（录制完成即发送） -->
        <div class="cp-composer__voice">
          <VoiceMessageRecorder
            :disabled="Boolean(props.disabled)"
            @recorded="handleVoiceRecorded"
            @error="(msg: string) => logger.error('Action: chat_voice_message_recorder_error', { error: msg })"
          />
          <span class="cp-composer__hint">{{ t("voice_composer_hint") }}</span>
        </div>
      </template>
      <template v-else>
        <AttachmentPreviewBar
          :attachments="attachments"
          @remove="removeAttachment"
          @retry="handleRetryAttachment"
          @openLightbox="(payload: { url: string; fileName: string; isVideo?: boolean }) => emit('openLightbox', payload)"
        />
        <t-textarea
          :model-value="props.draft"
          :disabled="props.domainId.trim() !== 'Core:Text' || Boolean(props.disabled) || Boolean(props.sending)"
          :placeholder="props.domainId.trim() === 'Core:Text' ? t('message_input_placeholder') : t('plugin_composer_placeholder')"
          :autosize="{ minRows: 2, maxRows: 6 }"
          @focus="handleFocus"
          @keydown="handleKeydown"
          @update:modelValue="handleUpdateDraft"
          @paste="handlePaste"
        />
        <!-- 内嵌发送按钮：覆盖在文本域右下角（z-index 高于文本层），padding-bottom 已预留其占位 -->
        <button
          class="cp-composer__send cp-composer__send--overlay"
          type="button"
          :disabled="!canSend || Boolean(props.sending)"
          @click="handleSend"
        >
          {{ props.sending ? `${t('send')}…` : t("send") }}
        </button>
      </template>
    </div>

    <!-- 操作行：仅在需要提示文案时渲染（发送按钮已内嵌至输入区） -->
    <div
      v-if="isPluginComposerActive || (props.domainId.trim() !== 'Core:Text' && !isVoiceDomain)"
      class="cp-composer__actions"
    >
      <div v-if="isPluginComposerActive" class="cp-composer__hint">{{ t("sent_by_plugin") }}</div>
      <div v-else class="cp-composer__hint">
        {{ t("no_composer_available") }}
      </div>
    </div>

    <!-- 链接预览 -->
    <LinkPreviewCard
      v-if="props.linkPreview"
      :preview="props.linkPreview"
      @dismiss="$emit('dismissLinkPreview')"
    />

    <!-- 提及菜单 -->
    <div v-if="props.mentionMenuOpen && (props.mentionCandidates?.length || systemMentions.length)" class="cp-mentionMenu" role="listbox">
      <button
        v-for="candidate in props.mentionCandidates"
        :key="candidate.userId"
        class="cp-mentionMenu__item"
        type="button"
        role="option"
        @mousedown.prevent="emit('selectMention', { userId: candidate.userId, displayName: candidate.displayName })"
      >
        {{ candidate.displayName }}
      </button>
      <div v-if="props.mentionCandidates?.length && systemMentions.length" class="cp-mentionMenu__sep"></div>
      <button
        v-for="sys in systemMentions"
        :key="sys.type"
        class="cp-mentionMenu__item"
        :class="{ 'cp-mentionMenu__item--disabled': sys.disabled }"
        :disabled="sys.disabled"
        :title="sys.disabled ? t('admin_only') : ''"
        type="button"
        @click="!sys.disabled && selectSystemMention(sys.type)"
      >
        {{ sys.label }}
      </button>
    </div>
    </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* 样式：ComposerHost｜规格：内容区内嵌卡片（cp-card，不叠加阴影）+ 字段/胶囊/状态条 token */
.cp-composer {
  position: relative;
  @include cp-card;

  padding: 10px;
}

.cp-composer__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.cp-composer__domainRow {
  margin-bottom: 8px;
}

.cp-composer__tools {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 工具栏图标按钮：统一 32×32 / 10px 圆角 / 静态透明（cp-icon-button 规格） */
.cp-composer__tools :deep(button) {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: var(--cp-radius-sm);
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-composer__tools :deep(button:hover):enabled {
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
}

/* 图标统一 18px（自绘内联 svg 与 AppIcon 字形共用同一尺寸契约） */
.cp-composer__tools :deep(svg) {
  width: 18px;
  height: 18px;
  display: block;
}

.cp-composer__tools :deep(.cp-stickerBtn__text),
.cp-composer__tools :deep(.cp-fileUpload__text) {
  display: none;
}

.cp-composer__inputArea {
  position: relative;
  margin-bottom: 6px;
}

/* 文本域：字段 token 由全局 TDesign 基线统一，这里只保留内嵌发送按钮的占位与聚焦内环 */
.cp-composer__inputArea :deep(.t-textarea__inner) {
  box-shadow: var(--cp-inset);
  /* 为右下角内嵌发送按钮预留空间：TDesign autosize 复制 padding 计算高度，故不会被文字占用 */
  padding-bottom: 40px;
}

/* 聚焦态：改用 inset 光环，绘制在边框盒内部，不会被任何祖先的 overflow:hidden 裁掉左右两侧 */
.cp-composer__inputArea :deep(.t-textarea__wrap:focus-within),
.cp-composer__inputArea :deep(.t-textarea:focus-within) {
  box-shadow: none !important;
}

.cp-composer__inputArea :deep(.t-textarea__inner:focus) {
  box-shadow:
    inset 0 0 0 2px color-mix(in oklab, var(--cp-highlight) 55%, transparent),
    var(--cp-inset) !important;
}

.cp-composer__plugin {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: var(--cp-radius-control);
  padding: 10px;
  box-shadow: var(--cp-inset);
}

.cp-composer__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  margin-bottom: 4px;
}

.cp-composer__hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--cp-text-muted);
  padding: 6px 8px;
}

/* 发送按钮：highlight = 主操作（工作台主按钮语义，不用品牌 accent） */
.cp-composer__send {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid var(--cp-highlight-border-strong);
  background: var(--cp-highlight-bg);
  color: var(--cp-text);
  border-radius: 999px;
  font-size: 12.5px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-composer__send:hover:enabled {
  background: var(--cp-highlight-bg-strong);
  border-color: var(--cp-highlight-border-strong);
}

.cp-composer__send:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 内嵌发送按钮：绝对定位贴文本域右下角，z-index 高于文本层；不透明底保证与下层文字的可读性 */
.cp-composer__send--overlay {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 5;
  background: color-mix(in oklab, var(--cp-highlight) 12%, var(--cp-panel));
  box-shadow: 0 2px 8px color-mix(in oklab, var(--cp-text) 10%, transparent);
}

.cp-composer__send--overlay:hover:enabled {
  /* 绝对定位元素不做位移，避免 hover 时在文本域内跳动 */
  transform: none;
  background: color-mix(in oklab, var(--cp-highlight) 18%, var(--cp-panel));
}

/* 回复条：cp-inline-status(info) 语义 */
.cp-reply {
  border: 1px solid var(--cp-info-border);
  background: var(--cp-info-bg);
  border-radius: var(--cp-radius-control);
  padding: 8px 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.cp-reply__title {
  @include cp-section-label;

  color: var(--cp-text-muted);
}

.cp-reply__snippet {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.4;
  color: var(--cp-text);
  max-width: 56ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 回复/引用条关闭按钮：设置页图标按钮（28px 紧凑版） */
.cp-reply__btn,
.cp-quoteBar__close {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid transparent;
  background: transparent;
  color: var(--cp-text-muted);
  border-radius: var(--cp-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease),
    color var(--cp-fast) var(--cp-ease);
}

.cp-reply__btn:hover,
.cp-quoteBar__close:hover {
  background: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
}

/* 错误提示：cp-inline-status(danger) */
.cp-composer__error {
  @include cp-inline-status(danger);

  margin-bottom: 10px;
}

/* 引用草稿条：cp-inline-status(info) 语义 + 左侧高亮竖条 */
.cp-quoteBar {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--cp-info-border);
  background: var(--cp-info-bg);
  border-radius: var(--cp-radius-control);
  padding: 8px 10px;
  margin-bottom: 10px;
}

.cp-quoteBar__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-highlight);
  flex-shrink: 0;
  align-self: stretch;
}

.cp-quoteBar__content {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  flex: 1;
}

.cp-quoteBar__label {
  @include cp-section-label;

  color: var(--cp-text-muted);
  white-space: nowrap;
}

.cp-quoteBar__preview {
  font-size: 12px;
  color: var(--cp-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 提及菜单：不透明浮层（菜单类）+ 行 hover 底色 */
.cp-mentionMenu {
  position: absolute;
  z-index: 70;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-solid);
  border-radius: var(--cp-radius-card);
  box-shadow: var(--cp-shadow-float);
  padding: 6px;
  margin-bottom: 6px;
}
.cp-mentionMenu__item {
  width: 100%;
  display: block;
  padding: 8px 10px;
  border-radius: var(--cp-radius-sm);
  border: none;
  background: transparent;
  color: var(--cp-text);
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
}
.cp-mentionMenu__item:hover {
  background: var(--cp-hover-bg);
}
.cp-mentionMenu__item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.cp-mentionMenu__item--disabled:hover {
  background: transparent;
}
.cp-mentionMenu__sep {
  height: 1px;
  margin: 6px 8px;
  background: var(--cp-border-light, var(--cp-border));
}

/* 折叠态高度过渡：与展开区对称的 1fr↔0fr，交叉渐变避免瞬时跳变 */
.cp-composer__collapsedExpander {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 300ms var(--cp-ease);
}

.cp-composer__collapsedExpander[data-open="false"] {
  grid-template-rows: 0fr;
}

.cp-composer__collapsedClip {
  overflow: hidden;
  min-height: 0;
}

.cp-composer__collapsed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  min-height: 40px;
  cursor: text;
  opacity: 1;
  transition: opacity 180ms var(--cp-ease);
}

.cp-composer__collapsedExpander[data-open="false"] .cp-composer__collapsed {
  opacity: 0;
  transition: opacity 120ms var(--cp-ease);
}

.cp-composer__collapsedPlaceholder {
  font-size: 13px;
  color: var(--cp-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-composer__collapsed .cp-composer__send {
  opacity: 0.55;
  cursor: not-allowed;
}

/* 展开区高度过渡：0fr↔1fr + 裁剪层，展开/折叠平滑不跳变 */
.cp-composer__expander {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 300ms var(--cp-ease),
    opacity 200ms var(--cp-ease);
}

.cp-composer__expander[data-open="true"] {
  grid-template-rows: 1fr;
  opacity: 1;
}

.cp-composer__expandedClip {
  overflow: hidden;
  min-height: 0;
}

/* 语音域编辑器面板 */
.cp-composer__voice {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0;
}

.cp-composer__expanded {
  display: flex;
  flex-direction: column;
  /* 左右留出负边距补偿：给聚焦环（3px）留出绘制空间，避免被裁剪层的 overflow:hidden 裁掉左右两侧 */
  padding: 0 4px;
  margin: 0 -4px;
}
</style>
