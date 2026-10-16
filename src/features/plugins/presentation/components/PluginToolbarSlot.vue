<script setup lang="ts">
import { computed } from "vue";
import type { PluginChatContext, ToolbarAction } from "@/features/plugins/api-types";

const props = defineProps<{ actions: ToolbarAction[]; chatContext?: PluginChatContext }>();
const sorted = computed(() =>
  [...props.actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
);
</script>

<template>
  <span class="plugin-toolbar-slot">
    <t-button
      v-for="a in sorted"
      :key="a.id"
      class="plugin-toolbar-slot__btn"
      size="small"
      variant="text"
      @click="a.onClick(props.chatContext ?? { channelId: '' })"
    >
      <template v-if="a.icon" #icon><component :is="a.icon" /></template>
      {{ a.label }}
    </t-button>
  </span>
</template>

<style scoped>
.plugin-toolbar-slot { display: inline-flex; gap: 8px; align-items: center; }

/* 工具栏入口：无外框图标按钮。
   TDesign 的 outline 变体自带可见边框+底色（顶栏里显得每个图标都套了个框），
   故改用 text 变体，并把内边距/圆角/悬停反馈对齐宿主顶栏的图标按钮（32×32、10px 圆角）。 */
.plugin-toolbar-slot .plugin-toolbar-slot__btn {
  height: auto;
  min-width: auto;
  padding: 8px;
  line-height: 1;
  border-radius: 10px;
}

.plugin-toolbar-slot .plugin-toolbar-slot__btn:hover,
.plugin-toolbar-slot .plugin-toolbar-slot__btn:focus-visible {
  background-color: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
  transform: none;
}
</style>
