<script setup lang="ts">
/**
 * @fileoverview ComposerHost.vue
 * @description Patchbay composer host (Domain selector + textarea + send).
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
 * Whether the active domain uses a plugin composer component.
 *
 * @returns `true` when plugin composer UI should be mounted.
 */
function computeIsPluginComposerActive(): boolean {
  return Boolean(props.pluginComposer);
}

const isPluginComposerActive = computed(computeIsPluginComposerActive);

/**
 * Whether the send action is currently allowed.
 *
 * Rules:
 * - Draft must contain at least one non-whitespace character.
 *
 * @returns `true` when sending should be enabled.
 */
function computeCanSend(): boolean {
  if (isPluginComposerActive.value) return false;
  if (props.domainId.trim() !== "Core:Text") return false;
  return props.draft.trim().length > 0;
}

const canSend = computed(computeCanSend);
const { t } = useI18n();

/**
 * Emit send request (disabled when draft is empty or currently sending).
 *
 * @returns void
 */
function handleSend(): void {
  if (!canSend.value) return;
  emit("send");
}

/**
 * Receive a submit payload from a plugin composer and forward to the host.
 *
 * @param payload - Plugin payload to send.
 * @returns void
 */
function handlePluginSubmit(payload: ComposerSubmitPayload): void {
  emit("send", payload);
}

/**
 * Emit cancel-reply request.
 *
 * @returns void
 */
function handleCancelReply(): void {
  emit("cancelReply");
}

/**
 * v-model adapter for DomainSelector.
 *
 * @param v - Selected domain id.
 * @returns void
 */
function handleUpdateDomainId(v: string): void {
  emit("update:domainId", v);
}

/**
 * v-model adapter for textarea draft.
 *
 * @param v - New draft value.
 * @returns void
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
/* ComposerHost styles */
/* Selector: `.cp-composer` — composer container (domain selector + input + send). */
.cp-composer {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel);
  border-radius: 18px;
  padding: 12px;
  box-shadow: var(--cp-shadow-soft);
}

/* Selector: `.cp-reply` — reply bar (shows referenced message snippet). */
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

/* Selector: `.cp-reply__title` — reply label line (uppercase). */
.cp-reply__title {
  font-family: var(--cp-font-display);
  letter-spacing: 0.10em;
  text-transform: uppercase;
  font-size: 11px;
  color: color-mix(in oklab, var(--cp-text) 72%, transparent);
}

/* Selector: `.cp-reply__snippet` — reply snippet preview (single-line ellipsis). */
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

/* Selector: `.cp-reply__btn` — cancel reply button. */
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

/* Selector: `.cp-reply__btn:hover` — hover lift + info border. */
.cp-reply__btn:hover {
  transform: translateY(-1px);
  background: var(--cp-hover-bg);
  border-color: color-mix(in oklab, var(--cp-info) 26%, var(--cp-border));
}

/* Selector: `.cp-composer__error` — send error banner (keeps draft). */
.cp-composer__error {
  border: 1px dashed color-mix(in oklab, var(--cp-danger) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  border-radius: 16px;
  padding: 10px 10px;
  font-size: 12px;
  color: color-mix(in oklab, var(--cp-text) 90%, transparent);
  margin-bottom: 10px;
}

/* Selector: `.cp-composer__row + .cp-composer__row` — section divider between rows. */
.cp-composer__row + .cp-composer__row {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cp-border-light);
}

/* Selector: `.cp-composer__plugin` — plugin composer mount surface. */
.cp-composer__plugin {
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  border-radius: 14px;
  padding: 10px;
  box-shadow: var(--cp-inset);
}

/* Selector: `.cp-composer__label` — row label (uppercase). */
.cp-composer__label {
  font-family: var(--cp-font-display);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cp-text-muted);
  margin-bottom: 10px;
}

/* Selector: `.cp-composer__actions` — action row alignment (send button on the right). */
.cp-composer__actions {
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* Selector: `.cp-composer__hint` — subtle hint for plugin composer mode. */
.cp-composer__hint {
  font-size: 12px;
  color: var(--cp-text-muted);
  padding: 6px 8px;
}

/* Selector: `.cp-composer__send` — send button base. */
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

/* Selector: `.cp-composer__send:hover:enabled` — hover affordance only when enabled. */
.cp-composer__send:hover:enabled {
  transform: translateY(-1px);
  border-color: color-mix(in oklab, var(--cp-accent) 34%, var(--cp-border));
  background: color-mix(in oklab, var(--cp-accent) 18%, var(--cp-hover-bg));
}

/* Selector: `.cp-composer__send:disabled` — disabled visual state. */
.cp-composer__send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
