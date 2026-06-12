<script setup lang="ts">
/**
 * @fileoverview ComposerHost.vue
 * @description chat｜组件：ComposerHost。
 */

import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import DomainSelector from "./DomainSelector.vue";
import LinkPreviewCard from "./LinkPreviewCard.vue";
import type { ChatLinkPreview } from "@/features/chat/domain/types/chatApiModels";
import type { ComposerSubmitPayload } from "@/features/chat/message-flow/api-types";
import AttachmentPreviewBar from "@/features/chat/message-flow/upload/presentation/components/AttachmentPreviewBar.vue";
import { addFiles, getAttachments, removeAttachment } from "@/features/chat/message-flow/upload/presentation/runtime/fileAttachmentStore";

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
 * - Draft 至少包含一个非空白字符。
 *
 * @returns 允许发送则为 `true`。
 */
function computeCanSend(): boolean {
  if (isPluginComposerActive.value) return false;
  if (props.domainId.trim() !== "Core:Text") return false;
  return props.draft.trim().length > 0;
}

const canSend = computed(computeCanSend);
const { t } = useI18n();

/** 附件列表快照（响应式）。 */
const attachments = computed(() => Array.from(getAttachments().values()));

/**
 * 处理粘贴事件：检测剪贴板中的图片并添加到附件列表。
 *
 * @param e - 原生剪贴板事件。
 */
function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items;
  if (!items) return;
  const imageFiles: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) imageFiles.push(file);
    }
  }
  if (imageFiles.length > 0) {
    e.preventDefault();
    addFiles(imageFiles);
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

  // 处理 Escape：关闭提及菜单
  if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    emit("closeMentionMenu");
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
  <!-- 组件：ComposerHost｜职责：发送区（DomainSelector + 输入 + Send） -->
  <!-- 区块：<section> .cp-composer -->
  <section class="cp-composer">
    <div v-if="props.replyTitle || props.replySnippet" class="cp-reply">
      <div class="cp-reply__left">
        <div class="cp-reply__title">{{ props.replyTitle || t("reply") }}</div>
        <div class="cp-reply__snippet">{{ props.replySnippet || "—" }}</div>
      </div>
      <button class="cp-reply__btn" type="button" @click="handleCancelReply">×</button>
    </div>

    <div v-if="props.quoteReplyDraft" class="cp-quoteBar">
      <div class="cp-quoteBar__bar"></div>
      <div class="cp-quoteBar__content">
        <span class="cp-quoteBar__label">{{ t("quoting") }}</span>
        <span class="cp-quoteBar__preview">{{ props.quoteReplyDraft.preview }}</span>
      </div>
      <button class="cp-quoteBar__close" type="button" @click="$emit('cancel-quote-reply')">&times;</button>
    </div>

    <div v-if="props.error" class="cp-composer__error" role="alert">
      {{ props.error }}
    </div>

    <div class="cp-composer__row">
      <div class="cp-composer__label">{{ t("composer_type") }}</div>
      <DomainSelector
        :model-value="props.domainId"
        :options="props.domainOptions"
        @update:model-value="handleUpdateDomainId"
      />
    </div>

    <div class="cp-composer__row">
      <div class="cp-composer__label">{{ t("composer_message") }}</div>
      <div v-if="isPluginComposerActive" class="cp-composer__plugin">
        <component
          :is="props.pluginComposer"
          :context="props.pluginContext"
          :replyToMid="props.replyToMid"
          :disabled="Boolean(props.disabled) || Boolean(props.sending)"
          @submit="handlePluginSubmit"
        />
      </div>
      <template v-else>
        <LinkPreviewCard
          v-if="props.linkPreview"
          :preview="props.linkPreview"
          @dismiss="$emit('dismissLinkPreview')"
        />
        <AttachmentPreviewBar
          :attachments="attachments"
          @remove="removeAttachment"
          @retry="handleRetryAttachment"
        />
        <t-textarea
          :model-value="props.draft"
          :disabled="props.domainId.trim() !== 'Core:Text' || Boolean(props.disabled) || Boolean(props.sending)"
          :placeholder="props.domainId.trim() === 'Core:Text' ? t('message_input_placeholder') : t('plugin_composer_placeholder')"
          :autosize="{ minRows: 2, maxRows: 6 }"
          @keydown="handleKeydown"
          @update:modelValue="handleUpdateDraft"
          @paste="handlePaste"
        />
      </template>
    </div>

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

    <div class="cp-composer__actions">
      <div v-if="isPluginComposerActive" class="cp-composer__hint">{{ t("sent_by_plugin") }}</div>
      <div v-else-if="props.domainId.trim() !== 'Core:Text'" class="cp-composer__hint">{{ t("no_composer_available") }}</div>
      <button v-else class="cp-composer__send" type="button" :disabled="!canSend || Boolean(props.sending)" @click="handleSend">
        {{ props.sending ? `${t('send')}…` : t("send") }}
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；包含回复条、错误条、两行输入区与底部动作区。 */
.cp-composer {
  position: relative;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
  box-shadow: var(--cp-shadow-soft);
}

.cp-reply {
  border: 1px solid color-mix(in oklab, var(--cp-info) 20%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 10%, var(--cp-panel));
  border-radius: 16px;
  padding: 10px 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.cp-reply__title {
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: color-mix(in oklab, var(--cp-text) 72%, transparent);
}

.cp-reply__snippet {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--cp-text);
  max-width: 56ch;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-reply__btn {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-reply__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 26%, var(--cp-border));
}

.cp-composer__error {
  border: 1px dashed color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  border-radius: 16px;
  padding: 10px 10px;
  font-size: 12px;
  color: color-mix(in oklab, var(--cp-text) 90%, transparent);
  margin-bottom: 10px;
}

.cp-composer__row + .cp-composer__row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

.cp-composer__plugin {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
  box-shadow: var(--cp-inset);
}

.cp-composer__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 10px;
}

.cp-composer__actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.cp-composer__hint {
  font-size: 12px;
  color: var(--cp-text-muted);
  padding: 6px 8px;
}

.cp-composer__send {
  border: 1px solid color-mix(in oklab, var(--cp-accent) 30%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 14%, var(--cp-panel-muted));
  color: var(--cp-text);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 12px;
  cursor: pointer;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}

.cp-composer__send:hover:enabled {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--cp-accent) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

.cp-composer__send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cp-quoteBar {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid color-mix(in oklab, var(--cp-info) 20%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-info) 10%, var(--cp-panel));
  border-radius: 16px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.cp-quoteBar__bar {
  width: 3px;
  border-radius: 2px;
  background: var(--cp-info, #89b4fa);
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
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: color-mix(in oklab, var(--cp-text) 72%, transparent);
  white-space: nowrap;
}
.cp-quoteBar__preview {
  font-size: 12px;
  color: var(--cp-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-quoteBar__close {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  border-radius: 999px;
  width: 28px;
  height: 28px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    transform var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease),
    border-color var(--cp-fast) var(--cp-ease);
}
.cp-quoteBar__close:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 26%, var(--cp-border));
}

/* 提及自动补全菜单 */
.cp-mentionMenu {
  position: absolute;
  z-index: 70;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 14px;
  box-shadow: var(--cp-shadow);
  padding: 6px;
  margin-bottom: 6px;
}
.cp-mentionMenu__item {
  width: 100%;
  display: block;
  padding: 8px 10px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: var(--cp-text);
  font-size: 12px;
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
</style>
