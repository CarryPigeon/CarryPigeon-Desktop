<script setup lang="ts">
import { computed } from "vue";
import type { PluginChatContext, ToolbarAction } from "@/features/plugins/api-types";

const props = defineProps<{ actions: ToolbarAction[]; chatContext?: PluginChatContext }>();
const sorted = computed(() =>
  [...props.actions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
);

/** 入口标签：插件通常只注册图标，空白/缺失标签都按"无标签"处理。 */
function labelOf(action: ToolbarAction): string {
  return String(action.label ?? "").trim();
}
</script>

<template>
  <span class="plugin-toolbar-slot">
    <t-button
      v-for="a in sorted"
      :key="a.id"
      class="plugin-toolbar-slot__btn"
      :class="{ 'plugin-toolbar-slot__btn--iconOnly': labelOf(a).length === 0 }"
      size="small"
      variant="text"
      @click="a.onClick(props.chatContext ?? { channelId: '' })"
    >
      <template v-if="a.icon" #icon><component :is="a.icon" /></template>
      <!-- 无标签时不输出默认插槽：模板里的空白/空插值会变成只含空格的文本节点，
          被 TDesign 当成"有文本"，导致图标入口多出 8px 文本槽、按钮变宽且图标不居中。 -->
      <template v-if="labelOf(a)">{{ labelOf(a) }}</template>
    </t-button>
  </span>
</template>

<style scoped>
.plugin-toolbar-slot {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

/* 工具栏入口：无外框图标按钮。
   TDesign 的 outline 变体自带可见边框+底色（顶栏里显得每个图标都套了个框），
   故改用 text 变体，并把内边距/圆角/悬停反馈对齐宿主顶栏的图标按钮（32×32、10px 圆角、6px 间距）。 */
.plugin-toolbar-slot .plugin-toolbar-slot__btn {
  height: auto;
  min-width: auto;
  padding: 8px;
  line-height: 1;
  border-radius: var(--cp-radius-sm);
}

/* 图标入口（插件只注册图标时）：固定 32×32 且内边距归零，
   让悬停/聚焦底色以图标为中心，与相邻的固定/搜索/设置/@提醒图标按钮完全一致。 */
.plugin-toolbar-slot .plugin-toolbar-slot__btn--iconOnly {
  width: 32px;
  height: 32px;
  padding: 0;
}

.plugin-toolbar-slot .plugin-toolbar-slot__btn:hover,
.plugin-toolbar-slot .plugin-toolbar-slot__btn:focus-visible {
  background-color: var(--cp-hover-bg);
  border-color: var(--cp-border);
  color: var(--cp-text);
  transform: none;
}
</style>
