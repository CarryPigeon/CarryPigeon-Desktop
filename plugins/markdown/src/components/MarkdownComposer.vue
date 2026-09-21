<script setup lang="ts">
// markdown 编辑器：textarea 编辑 + 预览切换，submit 事件携带与宿主契约一致的 payload。
import { computed, ref } from "vue";
import { parseMarkdown } from "../domain/markdownParser";
import { buildMarkdownComposerPayload } from "../domain/markdownPayload";
import MarkdownInlineView from "./MarkdownInlineView.vue";

const draft = ref("");
const previewing = ref(false);
const props = defineProps<{
  disabled?: boolean;
  replyToMid?: string;
}>();

const emit = defineEmits<{
  (
    e: "submit",
    payload: { domain: string; domainVersion: string; data: { text: string }; replyToMessageId?: string },
  ): void;
}>();

// 预览渲染树：复用领域纯函数，保证预览路径与正式渲染一致。
const previewBlocks = computed(() => parseMarkdown(draft.value));
const canSubmit = computed(() => !props.disabled && draft.value.trim().length > 0);

function togglePreview(): void {
  previewing.value = !previewing.value;
}

function submit(): void {
  if (props.disabled) return;
  const payload = buildMarkdownComposerPayload(draft.value, props.replyToMid);
  if (!payload) return;
  emit("submit", payload);
  draft.value = "";
  previewing.value = false;
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
      <span v-if="replyToMid" class="cp-md-composer__reply">回复消息 {{ replyToMid }}</span>
    </div>

    <!-- 编辑态：普通输入；Ctrl/Cmd+Enter 快捷发送，不阻断换行 -->
    <textarea
      v-if="!previewing"
      v-model="draft"
      class="cp-md-composer__input"
      :disabled="disabled"
      rows="4"
      placeholder="支持 Markdown：# 标题、**加粗**、*斜体*、`代码`、```代码块```、列表、[链接](https://...)"
      @keydown.ctrl.enter.prevent="submit"
      @keydown.meta.enter.prevent="submit"
    />
    <!-- 预览态：渲染树插值输出，全部为文本节点，无 innerHTML -->
    <div v-else class="cp-md-composer__preview cp-md-message">
      <template v-for="(block, i) in previewBlocks" :key="i">
        <h3 v-if="block.type === 'heading' && block.level === 1"><MarkdownInlineView :nodes="block.children" /></h3>
        <h4 v-else-if="block.type === 'heading' && block.level === 2"><MarkdownInlineView :nodes="block.children" /></h4>
        <h5 v-else-if="block.type === 'heading'"><MarkdownInlineView :nodes="block.children" /></h5>
        <pre v-else-if="block.type === 'codeBlock'" class="cp-md-code-block"><code>{{ block.text }}</code></pre>
        <ul v-else-if="block.type === 'list' && !block.ordered" class="cp-md-list">
          <li v-for="(item, j) in block.items" :key="j"><MarkdownInlineView :nodes="item" /></li>
        </ul>
        <ol v-else-if="block.type === 'list'" class="cp-md-list">
          <li v-for="(item, j) in block.items" :key="j"><MarkdownInlineView :nodes="item" /></li>
        </ol>
        <p v-else class="cp-md-paragraph"><MarkdownInlineView :nodes="block.children" /></p>
      </template>
      <p v-if="!previewBlocks.length" class="cp-md-paragraph cp-md-paragraph--empty">（暂无内容 / Nothing to preview）</p>
    </div>

    <div class="cp-md-composer__actions">
      <button type="button" class="cp-md-composer__send" :disabled="!canSubmit" @click="submit">
        发送 / Send
      </button>
    </div>
  </div>
</template>
