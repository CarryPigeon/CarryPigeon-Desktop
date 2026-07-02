<script setup lang="ts">
import { useI18n } from "vue-i18n";

type Tool = "select" | "pen" | "arrow" | "rect" | "text" | "mosaic";

const props = defineProps<{
  activeTool: Tool;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  hasSelection: boolean;
}>();

const emit = defineEmits<{
  (e: "toolChange", tool: Tool): void;
  (e: "colorChange", color: string): void;
  (e: "widthChange", width: number): void;
  (e: "undo"): void;
}>();

const { t } = useI18n();

const tools: Array<{ id: Tool; label: string; icon: string }> = [
  { id: "select", label: t("annotation_tool_select"), icon: "arrow-up-right" },
  { id: "pen", label: t("annotation_tool_pen"), icon: "edit" },
  { id: "arrow", label: t("annotation_tool_arrow"), icon: "arrow-right" },
  { id: "rect", label: t("annotation_tool_rect"), icon: "rectangle" },
  { id: "text", label: t("annotation_tool_text"), icon: "text" },
  { id: "mosaic", label: t("annotation_tool_mosaic"), icon: "view-module" },
];

const colors = ["#ff4444", "#ff8c00", "#ffd700", "#44ff44", "#44aaff", "#ffffff", "#000000"];

const presetWidths = [2, 4, 6, 10, 16];
</script>

<template>
  <div class="cp-annotation-toolbar">
    <div class="cp-annotation-toolbar__group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        type="button"
        class="cp-annotation-tool"
        :class="{ 'cp-annotation-tool--active': activeTool === tool.id }"
        :title="tool.label"
        :aria-label="tool.label"
        @click="emit('toolChange', tool.id)"
      >
        <t-icon :name="tool.icon" />
      </button>
    </div>

    <div class="cp-annotation-toolbar__group">
      <div v-for="c in colors" :key="c" class="cp-annotation-color-wrap">
        <input
          type="radio"
          :checked="strokeColor === c"
          :value="c"
          class="cp-annotation-color-input"
          :aria-label="t('annotation_color', { color: c })"
          @change="emit('colorChange', c)"
        />
        <label
          class="cp-annotation-color-swatch"
          :style="{ background: c }"
          @click="emit('colorChange', c)"
        ></label>
      </div>
    </div>

    <div class="cp-annotation-toolbar__group">
      <button
        v-for="w in presetWidths"
        :key="w"
        type="button"
        class="cp-annotation-width"
        :class="{ 'cp-annotation-width--active': strokeWidth === w }"
        :title="t('annotation_width', { width: w })"
        :aria-label="t('annotation_width', { width: w })"
        @click="emit('widthChange', w)"
      >
        <span class="cp-annotation-width__line" :style="{ height: `${Math.min(w, 14)}px` }"></span>
      </button>
    </div>

    <div class="cp-annotation-toolbar__group">
      <button
        type="button"
        class="cp-annotation-tool"
        :title="t('annotation_tool_undo')"
        :aria-label="t('annotation_tool_undo')"
        @click="emit('undo')"
      >
        <t-icon name="undo" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.cp-annotation-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.cp-annotation-toolbar__group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  border-right: 1px solid rgba(255, 255, 255, 0.1);
}
.cp-annotation-toolbar__group:last-child {
  border-right: none;
}

.cp-annotation-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  background: transparent;
  color: #ccc;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.12s ease;
}
.cp-annotation-tool:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}
.cp-annotation-tool--active {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.3);
}

.cp-annotation-color-wrap {
  position: relative;
  width: 22px;
  height: 22px;
}

.cp-annotation-color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.cp-annotation-color-swatch {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.12s ease;
}
.cp-annotation-color-input:checked + .cp-annotation-color-swatch {
  border-color: #fff;
}

.cp-annotation-width {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 28px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.12s ease;
}
.cp-annotation-width:hover {
  background: rgba(255, 255, 255, 0.1);
}
.cp-annotation-width--active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
}

.cp-annotation-width__line {
  display: block;
  width: 16px;
  background: #ccc;
  border-radius: 2px;
}
</style>
