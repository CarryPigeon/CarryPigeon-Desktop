<script setup lang="ts">
/**
 * @fileoverview ComposerHost.vue
 * @description chat｜组件：ComposerHost。
 */

import { computed, type Component } from "vue";
import { useI18n } from "vue-i18n";
import DomainSelector from "./DomainSelector.vue";
import type { ComposerSubmitPayload } from "@/features/chat/presentation/store/chatStoreTypes";

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
}>();

const emit = defineEmits<{
  (e: "update:domainId", v: string): void;
  (e: "update:draft", v: string): void;
  (e: "send", payload?: ComposerSubmitPayload): void;
  (e: "cancelReply"): void;
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
 * @param v - 新的 draft 值。
 * @returns 无返回值。
 */
function handleUpdateDraft(v: string): void {
  emit("update:draft", v);
}
</script>

<template>
  <!-- 组件：ComposerHost｜职责：发送区（DomainSelector + 输入 + Send） -->
  <!-- 区块：<section> .cp-composer -->
  <section class="cp-composer">
    <div v-if="props.replyTitle || props.replySnippet" class="cp-reply">
      <div class="cp-reply__left">
        <div class="cp-reply__title">{{ props.replyTitle || "Reply" }}</div>
        <div class="cp-reply__snippet">{{ props.replySnippet || "—" }}</div>
      </div>
      <button class="cp-reply__btn" type="button" @click="handleCancelReply">×</button>
    </div>

    <div v-if="props.error" class="cp-composer__error" role="alert">
      {{ props.error }}
    </div>

    <div class="cp-composer__row">
      <div class="cp-composer__label">Domain</div>
      <DomainSelector
        :model-value="props.domainId"
        :options="props.domainOptions"
        @update:model-value="handleUpdateDomainId"
      />
    </div>

    <div class="cp-composer__row">
      <div class="cp-composer__label">Signal</div>
      <div v-if="isPluginComposerActive" class="cp-composer__plugin">
        <component
          :is="props.pluginComposer"
          :context="props.pluginContext"
          :replyToMid="props.replyToMid"
          :disabled="Boolean(props.disabled) || Boolean(props.sending)"
          @submit="handlePluginSubmit"
        />
      </div>
      <t-textarea
        v-else
        :model-value="props.draft"
        :disabled="props.domainId.trim() !== 'Core:Text' || Boolean(props.disabled) || Boolean(props.sending)"
        :placeholder="props.domainId.trim() === 'Core:Text' ? t('message_input_placeholder') : 'This domain uses a plugin composer'"
        :autosize="{ minRows: 2, maxRows: 6 }"
        @update:modelValue="handleUpdateDraft"
      />
    </div>

    <div class="cp-composer__actions">
      <div v-if="isPluginComposerActive" class="cp-composer__hint">{{ t("send") }} via plugin composer</div>
      <div v-else-if="props.domainId.trim() !== 'Core:Text'" class="cp-composer__hint">No composer available for this domain</div>
      <button v-else class="cp-composer__send" type="button" :disabled="!canSend || Boolean(props.sending)" @click="handleSend">
        {{ props.sending ? `${t('send')}…` : t("send") }}
      </button>
    </div>
  </section>
</template>

<style scoped lang="scss">
/* 布局与变量说明：使用全局 `--cp-*` 变量；包含回复条、错误条、两行输入区与底部动作区。 */
.cp-composer {
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
</style>
