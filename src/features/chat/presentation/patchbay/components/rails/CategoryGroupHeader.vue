<script setup lang="ts">
/**
 * @fileoverview CategoryGroupHeader.vue
 * @description Patchbay 频道栏分类分组标题：显示分类名称、频道计数、折叠/展开切换。
 */
import { computed } from "vue";

const props = defineProps<{
  /** 分类分组 ID。 */
  groupId: string;
  /** 分类名称。 */
  name: string;
  /** 该分类下的频道数量。 */
  count: number;
  /** 是否已折叠。 */
  collapsed?: boolean;
  /** 是否显示为未分类样式（弱化视觉）。 */
  isUncategorized?: boolean;
}>();

const emit = defineEmits<{
  /** 点击标题切换折叠/展开。 */
  (event: "toggle", groupId: string): void;
}>();

const displayName = computed(() => {
  if (props.isUncategorized) return props.name;
  return props.name || props.groupId;
});

function handleToggle(): void {
  emit("toggle", props.groupId);
}
</script>

<template>
  <!-- 组件：CategoryGroupHeader｜职责：频道分类分组标题 -->
  <div
    class="cp-categoryHeader"
    :class="{ 'cp-categoryHeader--uncategorized': isUncategorized }"
    role="button"
    :tabindex="0"
    :aria-expanded="!collapsed"
    :aria-label="`${displayName} (${count})`"
    @click="handleToggle"
    @keydown.enter="handleToggle"
    @keydown.space.prevent="handleToggle"
  >
    <span class="cp-categoryHeader__arrow" :data-collapsed="collapsed">▾</span>
    <span class="cp-categoryHeader__name">{{ displayName }}</span>
    <span class="cp-categoryHeader__count">{{ count }}</span>
  </div>
</template>

<style scoped>
/* 频道分类分组标题 */
.cp-categoryHeader {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--cp-text-muted);
  cursor: pointer;
  user-select: none;
  transition: color var(--cp-fast) var(--cp-ease);
}

.cp-categoryHeader:hover {
  color: var(--cp-text);
}

.cp-categoryHeader--uncategorized {
  font-weight: 400;
  font-style: italic;
}

/* 折叠/展开箭头 */
.cp-categoryHeader__arrow {
  font-size: 10px;
  transition: transform var(--cp-fast) var(--cp-ease);
}

.cp-categoryHeader__arrow[data-collapsed="true"] {
  transform: rotate(-90deg);
}

/* 分组名称 */
.cp-categoryHeader__name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 频道计数 */
.cp-categoryHeader__count {
  font-size: 10px;
  font-weight: 400;
  color: var(--cp-text-light);
  background: var(--cp-hover-bg);
  border-radius: 999px;
  padding: 0 6px;
  line-height: 16px;
}
</style>
