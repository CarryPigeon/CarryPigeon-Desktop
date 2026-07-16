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
      size="small"
      variant="outline"
      @click="a.onClick(props.chatContext ?? { channelId: '' })"
    >
      <template v-if="a.icon" #icon><component :is="a.icon" /></template>
      {{ a.label }}
    </t-button>
  </span>
</template>

<style scoped>
.plugin-toolbar-slot { display: inline-flex; gap: 8px; align-items: center; }
</style>
