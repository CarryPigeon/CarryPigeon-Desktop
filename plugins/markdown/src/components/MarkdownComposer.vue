<script setup lang="ts">
// markdown 编辑器：textarea 编辑 + 预览切换，submit 事件携带与宿主契约一致的 payload。
import { computed, nextTick, ref } from "vue";
import { buildMarkdownComposerPayload, type MarkdownComposerPayload } from "../domain/markdownPayload";
import MarkdownMessage from "./MarkdownMessage.vue";

const draft = ref("");
const previewing = ref(false);
const input = ref<HTMLTextAreaElement | null>(null);
const submitting = ref(false);
const composing = ref(false);
const props = defineProps<{
  disabled?: boolean;
  replyToMid?: string;
}>();

const emit = defineEmits<{
  (
    e: "submit",
    payload: MarkdownComposerPayload,
    onSettled: (ok: boolean) => void,
  ): void;
}>();

const previewText = computed(() => draft.value.trim());
const canSubmit = computed(() => !props.disabled && !submitting.value && !composing.value && previewText.value.length > 0);

async function togglePreview(): Promise<void> {
  previewing.value = !previewing.value;
  if (!previewing.value) {
    await nextTick();
    input.value?.focus();
  }
}

async function insertFormat(before: string, after: string): Promise<void> {
  const field = input.value;
  if (!field || props.disabled || submitting.value || composing.value) return;
  const { selectionStart: start, selectionEnd: end } = field;
  const text = draft.value;
  draft.value = text.slice(0, start) + before + text.slice(start, end) + after + text.slice(end);
  await nextTick();
  field.focus();
  field.setSelectionRange(start + before.length, end + before.length);
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return;
  if (event.isComposing || composing.value || event.keyCode === 229) return;
  event.preventDefault();
  event.stopPropagation();
  submit();
}

function submit(): void {
  if (!canSubmit.value) return;
  const sentDraft = draft.value;
  const payload = buildMarkdownComposerPayload(sentDraft, props.replyToMid);
  if (!payload) return;
  submitting.value = true;
  emit("submit", payload, (ok) => {
    submitting.value = false;
    if (!ok || draft.value !== sentDraft) return;
    draft.value = "";
    previewing.value = false;
  });
}
</script>

<template>
  <div class="cp-md-composer">
    <div class="cp-md-composer__bar">
      <button
        type="button"
        class="cp-md-composer__toggle"
        :disabled="disabled"
        @click="togglePreview"
      >
        {{ previewing ? "继续编辑 / Edit" : "预览 / Preview" }}
      </button>
      <template v-if="!previewing">
        <button type="button" class="cp-md-composer__toggle" :disabled="disabled || submitting" @click="insertFormat('**', '**')">加粗 / Bold</button>
        <button type="button" class="cp-md-composer__toggle" :disabled="disabled || submitting" @click="insertFormat('*', '*')">斜体 / Italic</button>
        <button type="button" class="cp-md-composer__toggle" :disabled="disabled || submitting" @click="insertFormat('`', '`')">代码 / Code</button>
      </template>
      <span v-if="replyToMid" class="cp-md-composer__reply">回复消息 {{ replyToMid }}</span>
    </div>

    <!-- 编辑态：普通输入；Ctrl/Cmd+Enter 快捷发送，不阻断换行 -->
    <textarea
      v-if="!previewing"
      ref="input"
      v-model="draft"
      class="cp-md-composer__input"
      :disabled="disabled || submitting"
      aria-label="Markdown"
      rows="4"
      placeholder="支持 Markdown：# 标题、**加粗**、*斜体*、`代码`、```代码块```、列表、[链接](https://...)"
      @compositionstart="composing = true"
      @compositionend="composing = false"
      @keydown="handleKeydown"
    />
    <div v-else class="cp-md-composer__preview">
      <MarkdownMessage v-if="previewText" :data="{ text: previewText }" />
      <p v-else class="cp-md-paragraph cp-md-paragraph--empty">（暂无内容 / Nothing to preview）</p>
    </div>

    <div class="cp-md-composer__actions">
      <button type="button" class="cp-md-composer__send" :disabled="!canSubmit" aria-keyshortcuts="Control+Enter Meta+Enter" @click="submit">
        {{ submitting ? "发送中… / Sending…" : "发送 / Send (Ctrl/⌘ + Enter)" }}
      </button>
    </div>
  </div>
</template>
