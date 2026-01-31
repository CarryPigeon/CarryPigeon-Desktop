<script setup lang="ts">
/**
 * @fileoverview LabelBadge.vue
 * @description Industrial label badge (required/failed/update/domain/info).
 */

export type BadgeVariant = "required" | "failed" | "update" | "domain" | "info";

const props = withDefaults(
  defineProps<{
    variant: BadgeVariant;
    label: string;
  }>(),
  {
    variant: "info",
  },
);
</script>

<template>
  <!-- 组件：LabelBadge｜职责：标签徽章（必须文字 + 形状） -->
  <!-- 区块：<span> .label-badge -->
  <span class="label-badge" :data-variant="props.variant">
    <span class="label-badge__dot" aria-hidden="true"></span>
    <span class="label-badge__text">{{ props.label }}</span>
  </span>
</template>

<style scoped lang="scss">
.label-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 6px 10px;
  border: 1px solid var(--cp-border);
  background: var(--cp-panel-muted);
  color: var(--cp-text);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.label-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cp-domain-unknown);
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.12);
}

.label-badge__text {
  line-height: 1;
  white-space: nowrap;
}

.label-badge[data-variant="required"] {
  background: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel-muted));
  border-color: color-mix(in oklab, var(--cp-danger) 26%, var(--cp-border));
}
.label-badge[data-variant="required"] .label-badge__dot {
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.16);
}

.label-badge[data-variant="failed"] {
  background: color-mix(in oklab, var(--cp-danger) 12%, var(--cp-panel-muted));
  border-color: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
}
.label-badge[data-variant="failed"] .label-badge__dot {
  background: var(--cp-danger);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.18);
}

.label-badge[data-variant="update"] {
  background: color-mix(in oklab, var(--cp-info) 12%, var(--cp-panel-muted));
  border-color: color-mix(in oklab, var(--cp-info) 28%, var(--cp-border));
}
.label-badge[data-variant="update"] .label-badge__dot {
  background: var(--cp-info);
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.16);
}

.label-badge[data-variant="domain"] .label-badge__dot {
  background: var(--cp-domain-core);
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.14);
}
</style>

