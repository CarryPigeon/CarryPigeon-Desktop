<script setup lang="ts">
/**
 * @fileoverview App.vue root component.
 */
defineOptions({ name: "App" });
</script>

<template>
  <!-- 应用根组件：渲染路由视图（RouterView） -->
  <router-view></router-view>
</template>

<style lang="scss">
/* Global style entry: theme tokens + baseline aesthetics */

:root {
  /* Typography (distinctive stacks, graceful fallbacks) */
  --cp-font-display: "Smiley Sans", "LXGW WenKai", "Alibaba PuHuiTi 3.0", "HarmonyOS Sans SC",
    "PingFang SC", "Microsoft YaHei UI", sans-serif;
  --cp-font-body: "HarmonyOS Sans SC", "Alibaba PuHuiTi 2.0", "PingFang SC", "Microsoft YaHei UI",
    "Segoe UI", sans-serif;
  --cp-font-mono: "Iosevka", "JetBrains Mono", "Cascadia Mono", "SFMono-Regular", ui-monospace,
    Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  /* Palette: ink on warm paper */
  --cp-bg: #f6f1e7;
  --cp-bg-2: #e9f0ee;
  --cp-surface: rgba(255, 253, 248, 0.65);
  --cp-panel: rgba(255, 253, 248, 0.82);
  --cp-panel-solid: #fffdf8;
  --cp-panel-muted: rgba(238, 236, 229, 0.72);

  --cp-border: rgba(20, 32, 29, 0.14);
  --cp-border-light: rgba(20, 32, 29, 0.09);

  --cp-text: #14201d;
  --cp-text-muted: rgba(20, 32, 29, 0.62);
  --cp-text-light: rgba(20, 32, 29, 0.44);

  --cp-accent: #0f766e;
  --cp-accent-hover: #115e59;
  --cp-accent-soft: rgba(15, 118, 110, 0.14);
  --cp-accent-2: #c2410c;
  --cp-accent-2-soft: rgba(194, 65, 12, 0.14);
  --cp-warn: #b45309;
  --cp-info: #0284c7;
  --cp-danger: #b42318;
  --cp-accent-shadow: rgba(15, 118, 110, 0.22);

  /* Elevation */
  --cp-shadow: 0 26px 70px rgba(20, 32, 29, 0.16);
  --cp-shadow-soft: 0 10px 26px rgba(20, 32, 29, 0.12);
  --cp-ring: 0 0 0 3px rgba(15, 118, 110, 0.22);
  --cp-inset: inset 0 1px 0 rgba(255, 253, 248, 0.65);

  /* Inputs */
  --cp-field-height: 38px;
  --cp-field-pad-x: 12px;
  --cp-field-pad-y: 10px;
  --cp-field-radius: 14px;
  --cp-field-bg: rgba(255, 253, 248, 0.92);
  --cp-field-bg-hover: rgba(255, 253, 248, 0.96);
  --cp-field-bg-disabled: rgba(20, 32, 29, 0.03);
  --cp-field-border: rgba(20, 32, 29, 0.16);
  --cp-field-border-hover: rgba(20, 32, 29, 0.24);
  --cp-field-placeholder: rgba(20, 32, 29, 0.42);

  /* Domain cable colors */
  --cp-domain-core: #0f766e;
  --cp-domain-math: #2563eb;
  --cp-domain-poetry: #db2777;
  --cp-domain-mc: #7c3aed;
  --cp-domain-unknown: rgba(20, 32, 29, 0.42);

  /* Interaction */
  --cp-hover-bg: rgba(20, 32, 29, 0.06);
  --cp-hover-bg-2: rgba(20, 32, 29, 0.10);
  --cp-scroll-thumb: rgba(20, 32, 29, 0.18);
  --cp-scroll-thumb-hover: rgba(20, 32, 29, 0.26);
  --cp-glow-a: rgba(15, 118, 110, 0.22);
  --cp-glow-b: rgba(194, 65, 12, 0.14);
  --cp-glow-c: rgba(2, 132, 199, 0.10);

  /* Shape & motion */
  --cp-radius-sm: 10px;
  --cp-radius: 14px;
  --cp-radius-lg: 18px;
  --cp-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --cp-fast: 160ms;
  --cp-slow: 320ms;

  /* Layout sizes */
  --server-rail-width: 68px;
  --channel-list-width: 280px;
  --participants-list-width: 260px;

  /* TDesign token overrides (best-effort) */
  --td-brand-color: var(--cp-accent);
  --td-brand-color-hover: var(--cp-accent-hover);
  --td-text-color-primary: var(--cp-text);
  --td-text-color-secondary: var(--cp-text-muted);
  --td-bg-color-input: rgba(255, 253, 248, 0.92);
  --td-bg-color-container: rgba(255, 253, 248, 0.86);
  --td-bg-color-container-hover: rgba(255, 253, 248, 0.94);
  --td-bg-color-container-active: rgba(255, 253, 248, 0.72);
  --td-bg-color-secondarycontainer: rgba(20, 32, 29, 0.03);
  --td-border-level-1-color: var(--cp-border);
  --td-border-level-2-color: var(--cp-border);
  --td-brand-color-focus: rgba(15, 118, 110, 0.22);
  --td-mask-active: rgba(20, 32, 29, 0.34);
  --td-text-color-placeholder: var(--cp-field-placeholder);
  --td-text-color-disabled: var(--cp-text-light);
  --td-bg-color-specialcomponent: var(--cp-field-bg);
  --td-bg-color-component-disabled: var(--cp-field-bg-disabled);
  --td-radius-default: 12px;
  --td-radius-medium: 14px;
  --td-radius-large: 22px;
  --td-font-family: var(--cp-font-body);
}

:root[data-theme="patchbay"] {
  /* Typography */
  --cp-font-display: "Saira Semi Condensed", "DIN Alternate", "HarmonyOS Sans SC", "MiSans", "PingFang SC",
    "Microsoft YaHei UI", sans-serif;
  --cp-font-body: "Sarasa UI SC", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei UI",
    sans-serif;

  /* Surfaces */
  --cp-bg: #0b0f14;
  --cp-bg-2: #0f1620;
  --cp-surface: rgba(17, 24, 39, 0.62);
  --cp-panel: rgba(17, 24, 39, 0.78);
  --cp-panel-solid: #111827;
  --cp-panel-muted: rgba(17, 24, 39, 0.62);

  --cp-border: rgba(148, 163, 184, 0.18);
  --cp-border-light: rgba(148, 163, 184, 0.12);

  --cp-text: rgba(248, 250, 252, 0.92);
  --cp-text-muted: rgba(226, 232, 240, 0.62);
  --cp-text-light: rgba(226, 232, 240, 0.42);

  /* Status colors */
  --cp-accent: #22c55e;
  --cp-accent-hover: #16a34a;
  --cp-accent-soft: rgba(34, 197, 94, 0.16);
  --cp-accent-2: #38bdf8;
  --cp-accent-2-soft: rgba(56, 189, 248, 0.16);
  --cp-warn: #f59e0b;
  --cp-danger: #ef4444;
  --cp-info: #38bdf8;
  --cp-accent-shadow: rgba(34, 197, 94, 0.22);

  /* Ring */
  --cp-ring: 0 0 0 3px rgba(56, 189, 248, 0.28);
  --cp-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);

  /* Inputs */
  --cp-field-bg: rgba(17, 24, 39, 0.72);
  --cp-field-bg-hover: rgba(17, 24, 39, 0.82);
  --cp-field-bg-disabled: rgba(148, 163, 184, 0.06);
  --cp-field-border: rgba(148, 163, 184, 0.22);
  --cp-field-border-hover: rgba(148, 163, 184, 0.30);
  --cp-field-placeholder: rgba(226, 232, 240, 0.42);

  /* Domain cable colors */
  --cp-domain-core: #2dd4bf;
  --cp-domain-math: #60a5fa;
  --cp-domain-poetry: #f472b6;
  --cp-domain-mc: #a78bfa;
  --cp-domain-unknown: #94a3b8;

  /* Interaction */
  --cp-hover-bg: rgba(148, 163, 184, 0.08);
  --cp-hover-bg-2: rgba(148, 163, 184, 0.14);
  --cp-scroll-thumb: rgba(148, 163, 184, 0.18);
  --cp-scroll-thumb-hover: rgba(148, 163, 184, 0.26);
  --cp-glow-a: rgba(56, 189, 248, 0.10);
  --cp-glow-b: rgba(34, 197, 94, 0.10);
  --cp-glow-c: rgba(244, 114, 182, 0.08);

  /* Elevation */
  --cp-shadow: 0 22px 70px rgba(0, 0, 0, 0.62);
  --cp-shadow-soft: 0 12px 30px rgba(0, 0, 0, 0.45);

  /* TDesign overrides */
  --td-brand-color: rgba(56, 189, 248, 1);
  --td-brand-color-hover: rgba(125, 211, 252, 1);
  --td-text-color-primary: var(--cp-text);
  --td-text-color-secondary: var(--cp-text-muted);
  --td-bg-color-input: var(--cp-field-bg);
  --td-bg-color-container: var(--cp-panel);
  --td-bg-color-container-hover: rgba(17, 24, 39, 0.86);
  --td-bg-color-secondarycontainer: rgba(148, 163, 184, 0.06);
  --td-border-level-1-color: var(--cp-border);
  --td-border-level-2-color: var(--cp-border);
  --td-brand-color-focus: rgba(56, 189, 248, 0.28);
  --td-mask-active: rgba(0, 0, 0, 0.55);
  --td-text-color-placeholder: var(--cp-field-placeholder);
  --td-text-color-disabled: var(--cp-text-light);
  --td-bg-color-specialcomponent: var(--cp-field-bg);
  --td-bg-color-component-disabled: var(--cp-field-bg-disabled);
  --td-font-family: var(--cp-font-body);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#app {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--cp-font-body);
  color: var(--cp-text);
  background:
    radial-gradient(1200px 700px at 6% 4%, rgba(15, 118, 110, 0.22), transparent 60%),
    radial-gradient(980px 720px at 94% 10%, rgba(194, 65, 12, 0.14), transparent 62%),
    radial-gradient(900px 700px at 50% 115%, rgba(2, 132, 199, 0.1), transparent 58%),
    linear-gradient(180deg, var(--cp-bg), var(--cp-bg-2));
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

/* Patchbay background (graphite + grid) */
:root[data-theme="patchbay"] body {
  background:
    radial-gradient(900px 600px at 12% 0%, rgba(56, 189, 248, 0.10), transparent 60%),
    radial-gradient(1000px 760px at 92% 18%, rgba(34, 197, 94, 0.10), transparent 62%),
    linear-gradient(180deg, var(--cp-bg), var(--cp-bg-2));
  background-attachment: fixed;
}

/* Subtle “print” texture + grid (very low opacity) */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(20, 32, 29, 0.04),
      rgba(20, 32, 29, 0.04) 1px,
      transparent 1px,
      transparent 6px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(20, 32, 29, 0.03),
      rgba(20, 32, 29, 0.03) 1px,
      transparent 1px,
      transparent 10px
    );
  opacity: 0.18;
  mix-blend-mode: multiply;
}

:root[data-theme="patchbay"] body::before {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(148, 163, 184, 0.06),
      rgba(148, 163, 184, 0.06) 1px,
      transparent 1px,
      transparent 12px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.045),
      rgba(148, 163, 184, 0.045) 1px,
      transparent 1px,
      transparent 12px
    );
  opacity: 0.35;
  mix-blend-mode: normal;
}

::selection {
  background: rgba(15, 118, 110, 0.22);
}

:root[data-theme="patchbay"] ::selection {
  background: rgba(56, 189, 248, 0.28);
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}

h1,
h2,
h3,
h4 {
  font-family: var(--cp-font-display);
  letter-spacing: -0.015em;
}

:where(a, button, input, textarea, select, [tabindex]):focus-visible {
  outline: none;
  box-shadow: var(--cp-ring);
}

/* Prevent double focus rings inside TDesign wrappers */
.t-input__inner:focus-visible,
.t-textarea__inner:focus-visible {
  box-shadow: none !important;
}

/* Native input utility (opt-in via class) */
.cp-field {
  width: 100%;
  height: var(--cp-field-height);
  padding: 0 var(--cp-field-pad-x);
  border: 1px solid var(--cp-field-border);
  border-radius: var(--cp-field-radius);
  background: var(--cp-field-bg);
  color: var(--cp-text);
  font-size: 13px;
  line-height: calc(var(--cp-field-height) - 2px);
  caret-color: var(--cp-accent);
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
  box-shadow: var(--cp-inset);
}

.cp-field::placeholder {
  color: var(--cp-field-placeholder);
}

.cp-field:hover {
  border-color: var(--cp-field-border-hover);
  background: var(--cp-field-bg-hover);
}

.cp-field:focus {
  border-color: var(--cp-accent);
  box-shadow: var(--cp-ring);
}

.cp-field:disabled {
  cursor: not-allowed;
  opacity: 1;
  background: var(--cp-field-bg-disabled);
  border-color: var(--cp-border-light);
  color: var(--cp-text-muted);
}

textarea.cp-field {
  height: auto;
  min-height: 92px;
  padding: var(--cp-field-pad-y) var(--cp-field-pad-x);
  line-height: 1.45;
}

select.cp-field {
  line-height: normal;
  padding-right: 34px;
}

/* TDesign: inputs/textarea baseline (avoid double shadows) */
.t-input,
.t-input__wrap,
.t-textarea,
.t-textarea__wrap {
  border-color: var(--cp-field-border) !important;
  background: var(--cp-field-bg) !important;
  box-shadow: var(--cp-inset) !important;
  border-radius: var(--cp-field-radius) !important;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);

  &:hover {
    border-color: var(--cp-field-border-hover) !important;
    background: var(--cp-field-bg-hover) !important;
  }
}

.t-input:focus,
.t-input--focused,
.t-input.t-is-focused,
.t-input__wrap:focus-within,
.t-textarea:focus,
.t-textarea--focused,
.t-textarea.t-is-focused,
.t-textarea__wrap:focus-within {
  border-color: var(--cp-accent) !important;
  box-shadow: var(--cp-ring), var(--cp-inset) !important;
}

.t-input {
  height: var(--cp-field-height);
  padding: 0 var(--cp-field-pad-x);
}

.t-input.t-input--focused,
.t-input.t-is-focused,
.t-input.t-input--focused:hover,
.t-input.t-is-focused:hover {
  box-shadow: var(--cp-ring), var(--cp-inset) !important;
}

.t-input__inner::placeholder {
  color: var(--cp-field-placeholder) !important;
}

.t-textarea__inner {
  border-color: var(--cp-field-border) !important;
  background: var(--cp-field-bg) !important;
  border-radius: var(--cp-field-radius) !important;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.t-textarea__inner:hover {
  border-color: var(--cp-field-border-hover) !important;
  background: var(--cp-field-bg-hover) !important;
}

.t-textarea__inner:focus {
  border-color: var(--cp-accent) !important;
  box-shadow: var(--cp-ring), var(--cp-inset) !important;
}

.t-textarea__inner::placeholder {
  color: var(--cp-field-placeholder) !important;
}

.t-input.t-is-disabled .t-input__wrap,
.t-input__wrap.t-is-disabled,
.t-textarea__inner.t-is-disabled {
  background: var(--cp-field-bg-disabled) !important;
  border-color: var(--cp-border-light) !important;
}

/* TDesign: dialogs feel like the app */
.t-dialog {
  background: var(--cp-panel) !important;
  border-color: var(--cp-border) !important;
  box-shadow: var(--cp-shadow) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.t-dialog__mask {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.t-dialog__header {
  font-family: var(--cp-font-display);
  letter-spacing: -0.02em;
}

.t-dialog__footer .t-button {
  border-radius: 999px;
}

.t-dialog__footer .t-button.t-button--variant-base.t-button--theme-primary {
  box-shadow: 0 18px 40px var(--cp-accent-shadow);
}

/* TDesign: toast/message */
.t-message {
  background: var(--cp-panel) !important;
  border: 1px solid var(--cp-border-light);
  box-shadow: var(--cp-shadow-soft) !important;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* Native inputs */
input,
textarea,
select {
  &:focus {
    outline: none;
  }
}

/* Scrollbars (desktop-friendly) */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--cp-hover-bg-2) transparent;
}

::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--cp-scroll-thumb);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--cp-scroll-thumb-hover);
  border: 2px solid transparent;
  background-clip: padding-box;
}

@keyframes cp-fade-up {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
