<script setup lang="ts">
/**
 * @fileoverview 应用根组件（路由容器）。
 */
defineOptions({ name: "App" });
import { computed } from 'vue';
import { ConfigProvider as TConfigProvider } from 'tdesign-vue-next';
import StartupShell from '@/app/bootstrap/StartupShell.vue';
import ErrorBoundary from '@/shared/ui/ErrorBoundary.vue';
import ContextMenuHost from '@/shared/ui/contextMenu/ContextMenuHost.vue';
import { TD_ICON_OVERRIDES } from '@/shared/ui/icons/tdIconOverrides';

/**
 * TDesign 全局配置：把组件内置图标（输入框清除、密码显隐、对话框/抽屉关闭、Toast 状态、
 * 分页箭头）替换为应用自绘图标，保证界面内不再出现非自绘字形。
 */
const tdGlobalConfig = computed(() => ({ icon: TD_ICON_OVERRIDES }));
</script>

<template>
  <t-config-provider :global-config="tdGlobalConfig">
    <ErrorBoundary>
      <StartupShell>
        <router-view></router-view>
      </StartupShell>
      <ContextMenuHost />
    </ErrorBoundary>
  </t-config-provider>
</template>

<style lang="scss">
/* 全局样式入口：主题 token + 基础美学基线 */

:root {
  color-scheme: light;

  /* 字体（有辨识度的字体栈与回退） */
  --cp-font-display: "Smiley Sans", "LXGW WenKai", "Alibaba PuHuiTi 3.0", "HarmonyOS Sans SC",
    "PingFang SC", "Microsoft YaHei UI", sans-serif;
  --cp-font-body: "HarmonyOS Sans SC", "Alibaba PuHuiTi 2.0", "PingFang SC", "Microsoft YaHei UI",
    "Segoe UI", sans-serif;
  --cp-font-mono: "Iosevka", "JetBrains Mono", "Cascadia Mono", "SFMono-Regular", ui-monospace,
    Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  /* 调色板：暖纸底上的墨色 */
  --cp-bg: #f6f1e7;
  --cp-bg-2: #e9f0ee;
  --cp-surface: rgba(255, 253, 248, 0.65);
  --cp-panel: rgba(255, 253, 248, 0.82);
  --cp-panel-solid: #fffdf8;
  --cp-panel-muted: rgba(238, 236, 229, 0.72);

  --cp-border: rgba(20, 32, 29, 0.14);
  --cp-border-light: rgba(20, 32, 29, 0.09);

  --cp-text: #14201d;
  --cp-text-muted: rgba(20, 32, 29, 0.72);
  --cp-text-light: rgba(20, 32, 29, 0.52);

  --cp-accent: #0f766e;
  --cp-accent-hover: #115e59;
  --cp-accent-soft: rgba(15, 118, 110, 0.14);
  --cp-accent-2: #c2410c;
  --cp-accent-2-soft: rgba(194, 65, 12, 0.14);
  --cp-warn: #b45309;
  --cp-info: #0284c7;
  --cp-danger: #b42318;
  --cp-accent-shadow: rgba(15, 118, 110, 0.22);
  --cp-success: #059669;
  --cp-primary: #0f766e;
  --cp-skeleton: rgba(20, 32, 29, 0.08);
  --cp-warning: var(--cp-warn);

  /* 高亮（与主题相关的选中/聚焦强调色） */
  --cp-highlight: var(--cp-info);
  --cp-highlight-border: color-mix(in oklab, var(--cp-highlight) 40%, var(--cp-border));
  --cp-highlight-border-strong: color-mix(in oklab, var(--cp-highlight) 58%, var(--cp-border));
  --cp-highlight-bg: color-mix(in oklab, var(--cp-highlight) 12%, transparent);
  --cp-highlight-bg-strong: color-mix(in oklab, var(--cp-highlight) 18%, transparent);
  --cp-highlight-ring: 0 0 0 3px color-mix(in oklab, var(--cp-highlight) 22%, transparent);
  --cp-focus-border: var(--cp-highlight-border-strong);
  --cp-focus-ring: var(--cp-highlight-ring);

  /* 阴影层级（Elevation） */
  --cp-shadow: 0 18px 52px rgba(20, 32, 29, 0.14);
  --cp-shadow-soft: 0 8px 22px rgba(20, 32, 29, 0.10);
  /* 浮层阴影（菜单/气泡等 fixed 浮层） */
  --cp-shadow-float: 0 14px 38px rgba(20, 32, 29, 0.16);
  --cp-ring: 0 0 0 3px rgba(15, 118, 110, 0.22);
  --cp-inset: inset 0 1px 0 rgba(255, 253, 248, 0.65);
  --cp-elev-1: var(--cp-shadow-soft);
  --cp-elev-2: var(--cp-shadow);

  /* 输入控件 */
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

  /* 领域（Domain）线缆颜色（通用扩展通道） */
  --cp-domain-core: #0f766e;
  --cp-domain-ext-a: #2563eb;
  --cp-domain-ext-b: #db2777;
  --cp-domain-ext-c: #7c3aed;
  --cp-domain-unknown: rgba(20, 32, 29, 0.42);

  /* 交互态 */
  --cp-hover-bg: rgba(20, 32, 29, 0.06);
  --cp-hover-bg-2: rgba(20, 32, 29, 0.10);
  --cp-scroll-thumb: rgba(20, 32, 29, 0.18);
  --cp-scroll-thumb-hover: rgba(20, 32, 29, 0.26);
  --cp-glow-a: rgba(15, 118, 110, 0.22);
  --cp-glow-b: rgba(194, 65, 12, 0.14);
  --cp-glow-c: rgba(2, 132, 199, 0.10);

  /* 形状与动效 */
  --cp-radius-sm: 10px;
  --cp-radius: 14px;
  --cp-radius-lg: 18px;
  --cp-radius-card: 16px;
  --cp-radius-control: 12px;

  /* 页面骨架与玻璃面板（设置页视觉语言的全局基准） */
  --cp-page-pad: 14px;
  --cp-page-gap: 12px;
  --cp-glass-blur: blur(16px) saturate(1.08);
  --cp-section-head-gap: 20px;

  /* 状态底色/描边：由状态色 + 面板/边框色派生，亮/暗主题自动跟随 */
  --cp-danger-bg: color-mix(in oklab, var(--cp-danger) 10%, var(--cp-panel));
  --cp-danger-border: color-mix(in oklab, var(--cp-danger) 30%, var(--cp-border));
  --cp-warn-bg: color-mix(in oklab, var(--cp-warn) 10%, var(--cp-panel));
  --cp-warn-border: color-mix(in oklab, var(--cp-warn) 30%, var(--cp-border));
  --cp-success-bg: color-mix(in oklab, var(--cp-success) 10%, var(--cp-panel));
  --cp-success-border: color-mix(in oklab, var(--cp-success) 30%, var(--cp-border));
  --cp-info-bg: color-mix(in oklab, var(--cp-info) 10%, var(--cp-panel));
  --cp-info-border: color-mix(in oklab, var(--cp-info) 30%, var(--cp-border));

  --cp-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --cp-fast: 160ms;
  --cp-slow: 320ms;

  /* 布局尺寸 */
  --server-rail-width: 68px;
  --channel-list-width: 280px;
  --participants-list-width: 260px;

  /* 组件库（TDesign）token 覆盖（尽力而为） */
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

:root[data-theme="light"] {
  color-scheme: light;
}

:root[data-theme="dark"] {
  color-scheme: dark;

  /* 字体 */
  --cp-font-display: "Saira Semi Condensed", "DIN Alternate", "HarmonyOS Sans SC", "MiSans", "PingFang SC",
    "Microsoft YaHei UI", sans-serif;
  --cp-font-body: "Sarasa UI SC", "HarmonyOS Sans SC", "MiSans", "PingFang SC", "Microsoft YaHei UI",
    sans-serif;

  /* 表面（Surfaces） */
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

  /* 状态色（与背景耦合的部分：warn / danger / skeleton / warning） */
  --cp-warn: #f59e0b;
  --cp-danger: #ef4444;
  --cp-skeleton: rgba(148, 163, 184, 0.10);
  --cp-warning: var(--cp-warn);

  /* 高亮（依赖 --cp-info；info 放在 accent 块） */
  --cp-highlight: var(--cp-info);
  --cp-highlight-border: color-mix(in oklab, var(--cp-highlight) 40%, var(--cp-border));
  --cp-highlight-border-strong: color-mix(in oklab, var(--cp-highlight) 58%, var(--cp-border));
  --cp-highlight-bg: color-mix(in oklab, var(--cp-highlight) 12%, transparent);
  --cp-highlight-bg-strong: color-mix(in oklab, var(--cp-highlight) 18%, transparent);
  --cp-highlight-ring: 0 0 0 3px color-mix(in oklab, var(--cp-highlight) 22%, transparent);
  --cp-focus-border: var(--cp-highlight-border-strong);
  --cp-focus-ring: var(--cp-highlight-ring);

  /* 聚焦环（Ring） */
  --cp-inset: inset 0 1px 0 rgba(255, 255, 255, 0.06);

  /* 输入控件 */
  --cp-field-bg: rgba(17, 24, 39, 0.72);
  --cp-field-bg-hover: rgba(17, 24, 39, 0.82);
  --cp-field-bg-disabled: rgba(148, 163, 184, 0.06);
  --cp-field-border: rgba(148, 163, 184, 0.22);
  --cp-field-border-hover: rgba(148, 163, 184, 0.30);
  --cp-field-placeholder: rgba(226, 232, 240, 0.42);

  /* 交互态 */
  --cp-hover-bg: rgba(148, 163, 184, 0.08);
  --cp-hover-bg-2: rgba(148, 163, 184, 0.14);
  --cp-scroll-thumb: rgba(148, 163, 184, 0.18);
  --cp-scroll-thumb-hover: rgba(148, 163, 184, 0.26);

  /* 阴影层级（Elevation） */
  --cp-shadow: 0 18px 56px rgba(0, 0, 0, 0.56);
  --cp-shadow-soft: 0 10px 26px rgba(0, 0, 0, 0.40);
  /* 浮层阴影（菜单/气泡等 fixed 浮层） */
  --cp-shadow-float: 0 16px 40px rgba(0, 0, 0, 0.52);
  --cp-elev-1: var(--cp-shadow-soft);
  --cp-elev-2: var(--cp-shadow);

  /* 组件库（TDesign）覆盖（与背景/字体耦合） */
  --td-text-color-primary: var(--cp-text);
  --td-text-color-secondary: var(--cp-text-muted);
  --td-bg-color-input: var(--cp-field-bg);
  --td-bg-color-container: var(--cp-panel);
  --td-bg-color-container-hover: rgba(17, 24, 39, 0.86);
  --td-bg-color-secondarycontainer: rgba(148, 163, 184, 0.06);
  --td-border-level-1-color: var(--cp-border);
  --td-border-level-2-color: var(--cp-border);
  --td-mask-active: rgba(0, 0, 0, 0.55);
  --td-text-color-placeholder: var(--cp-field-placeholder);
  --td-text-color-disabled: var(--cp-text-light);
  --td-bg-color-specialcomponent: var(--cp-field-bg);
  --td-bg-color-component-disabled: var(--cp-field-bg-disabled);
  --td-font-family: var(--cp-font-body);
}

/* 强调色（独立于主题）：patchbay 翡翠绿 + 天空蓝的品牌色组合。
   可与任何 theme 组合（亮色/暗色），让聊天等页面在用户偏好的背景下仍保留品牌识别色。 */
:root[data-accent="patchbay"] {
  --cp-accent: #22c55e;
  --cp-accent-hover: #16a34a;
  --cp-accent-soft: rgba(34, 197, 94, 0.16);
  --cp-accent-2: #38bdf8;
  --cp-accent-2-soft: rgba(56, 189, 248, 0.16);
  --cp-info: #38bdf8;
  --cp-accent-shadow: rgba(34, 197, 94, 0.22);
  --cp-success: #22c55e;
  --cp-primary: #38bdf8;
  --cp-ring: 0 0 0 3px rgba(56, 189, 248, 0.28);

  /* 领域（Domain）线缆颜色（patchbay 配色版本） */
  --cp-domain-core: #2dd4bf;
  --cp-domain-ext-a: #60a5fa;
  --cp-domain-ext-b: #f472b6;
  --cp-domain-ext-c: #a78bfa;
  --cp-domain-unknown: #94a3b8;

  /* 光晕（Glow） */
  --cp-glow-a: rgba(56, 189, 248, 0.10);
  --cp-glow-b: rgba(34, 197, 94, 0.10);
  --cp-glow-c: rgba(244, 114, 182, 0.08);

  /* 组件库（TDesign）品牌色 */
  --td-brand-color: rgba(56, 189, 248, 1);
  --td-brand-color-hover: rgba(125, 211, 252, 1);
  --td-brand-color-focus: rgba(56, 189, 248, 0.28);
}

/* 兼容：暗色主题且未显式选择 default 强调色时，沿用 patchbay 品牌强调色。
   新逻辑下，用户独立设置 accent，可选 default/patchbay 来覆盖这里。 */
:root[data-theme="dark"]:not([data-accent="default"]) {
  --cp-accent: #22c55e;
  --cp-accent-hover: #16a34a;
  --cp-accent-soft: rgba(34, 197, 94, 0.16);
  --cp-accent-2: #38bdf8;
  --cp-accent-2-soft: rgba(56, 189, 248, 0.16);
  --cp-info: #38bdf8;
  --cp-accent-shadow: rgba(34, 197, 94, 0.22);
  --cp-success: #22c55e;
  --cp-primary: #38bdf8;
  --cp-ring: 0 0 0 3px rgba(56, 189, 248, 0.28);
  --cp-domain-core: #2dd4bf;
  --cp-domain-ext-a: #60a5fa;
  --cp-domain-ext-b: #f472b6;
  --cp-domain-ext-c: #a78bfa;
  --cp-domain-unknown: #94a3b8;
  --cp-glow-a: rgba(56, 189, 248, 0.10);
  --cp-glow-b: rgba(34, 197, 94, 0.10);
  --cp-glow-c: rgba(244, 114, 182, 0.08);
  --td-brand-color: rgba(56, 189, 248, 1);
  --td-brand-color-hover: rgba(125, 211, 252, 1);
  --td-brand-color-focus: rgba(56, 189, 248, 0.28);
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

/* 主题（亮色模式）背景（暖纸 + 柔和光晕） */
:root[data-theme="light"] body {
  background:
    radial-gradient(1200px 700px at 6% 4%, rgba(15, 118, 110, 0.22), transparent 60%),
    radial-gradient(980px 720px at 94% 10%, rgba(194, 65, 12, 0.14), transparent 62%),
    radial-gradient(900px 700px at 50% 115%, rgba(2, 132, 199, 0.1), transparent 58%),
    linear-gradient(180deg, var(--cp-bg), var(--cp-bg-2));
  background-attachment: fixed;
}

/* 主题（暗色模式）背景（石墨 + 网格） */
:root[data-theme="dark"] body {
  background:
    radial-gradient(900px 600px at 12% 0%, rgba(56, 189, 248, 0.10), transparent 60%),
    radial-gradient(1000px 760px at 92% 18%, rgba(34, 197, 94, 0.10), transparent 62%),
    linear-gradient(180deg, var(--cp-bg), var(--cp-bg-2));
  background-attachment: fixed;
}

/* 细微“纸纹”质感 + 网格（低透明度） */
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
  opacity: 0.14;
  mix-blend-mode: multiply;
}

:root[data-theme="light"] body::before {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(20, 32, 29, 0.04),
      rgba(20, 32, 29, 0.04) 1px,
      transparent 1px,
      transparent 10px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(20, 32, 29, 0.03),
      rgba(20, 32, 29, 0.03) 1px,
      transparent 1px,
      transparent 16px
    );
  opacity: 0.10;
  mix-blend-mode: multiply;
}

:root[data-theme="dark"] body::before {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(148, 163, 184, 0.06),
      rgba(148, 163, 184, 0.06) 1px,
      transparent 1px,
      transparent 20px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.045),
      rgba(148, 163, 184, 0.045) 1px,
      transparent 1px,
      transparent 20px
    );
  opacity: 0.14;
  mix-blend-mode: normal;
}

::selection {
  background: rgba(15, 118, 110, 0.22);
}

:root[data-theme="light"] ::selection {
  background: rgba(15, 118, 110, 0.22);
}

:root[data-theme="dark"] ::selection {
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
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
}

/* 防止在 TDesign 包裹层内出现双重 focus ring */
.t-input__inner:focus-visible,
.t-textarea__inner:focus-visible {
  box-shadow: none !important;
}

/* 原生输入控件工具类（按需启用） */
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
  border-color: var(--cp-focus-border);
  box-shadow: var(--cp-focus-ring, var(--cp-ring));
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

/* 组件库（TDesign）：输入框/文本域基线（避免双重阴影） */
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
  border-color: var(--cp-focus-border) !important;
  box-shadow: var(--cp-focus-ring, var(--cp-ring)), var(--cp-inset) !important;
}

.t-input {
  height: var(--cp-field-height);
  padding: 0 var(--cp-field-pad-x);
}

.t-input.t-input--focused,
.t-input.t-is-focused,
.t-input.t-input--focused:hover,
.t-input.t-is-focused:hover {
  box-shadow: var(--cp-focus-ring, var(--cp-ring)), var(--cp-inset) !important;
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
  border-color: var(--cp-focus-border) !important;
  box-shadow: var(--cp-focus-ring, var(--cp-ring)), var(--cp-inset) !important;
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

/* 组件库（TDesign）：下拉/选择器与输入框同一字段规格 */
.t-select,
.t-select__wrap,
.t-select-input {
  border-radius: var(--cp-radius-control) !important;
  border-color: var(--cp-field-border) !important;
  background: var(--cp-field-bg) !important;
  box-shadow: var(--cp-inset) !important;
  transition:
    border-color var(--cp-fast) var(--cp-ease),
    box-shadow var(--cp-fast) var(--cp-ease),
    background-color var(--cp-fast) var(--cp-ease);
}

.t-select:hover,
.t-select-input:hover {
  border-color: var(--cp-field-border-hover) !important;
  background: var(--cp-field-bg-hover) !important;
}

.t-select.t-is-focused,
.t-select-input.t-is-focused,
.t-select-input--focused {
  border-color: var(--cp-focus-border) !important;
  box-shadow: var(--cp-focus-ring, var(--cp-ring)) !important;
}

.t-select .t-input {
  background: transparent !important;
  box-shadow: none !important;
}

/* 组件库（TDesign）：抽屉统一为玻璃面板。
   注意：`.t-drawer` 是覆盖全屏的定位根节点（关闭时仍存在，仅 content 隐藏），
   不能给它加背景/模糊，否则关闭态会盖住整页；玻璃只加在内容面板上。 */
.t-drawer {
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.t-drawer__content-wrapper {
  background: var(--cp-panel) !important;
  border-color: var(--cp-border) !important;
  box-shadow: var(--cp-shadow) !important;
  backdrop-filter: var(--cp-glass-blur);
  -webkit-backdrop-filter: var(--cp-glass-blur);
}

.t-drawer--right .t-drawer__content-wrapper {
  border-left: 1px solid var(--cp-border);
}

.t-drawer__header {
  font-family: var(--cp-font-display);
  letter-spacing: -0.02em;
  color: var(--cp-text);
}

.t-drawer__body {
  color: var(--cp-text);
}

/* 组件库（TDesign）：浮层/气泡统一实心面板（避免半透明透出下层内容） */
.t-popup__content {
  background: var(--cp-panel-solid) !important;
  border: 1px solid var(--cp-border);
  border-radius: var(--cp-radius) !important;
  box-shadow: var(--cp-shadow-float) !important;
  color: var(--cp-text);
}

/* 组件库（TDesign）：按钮统一圆角/字体，颜色仍走 TDesign 语义 */
.t-button {
  border-radius: 999px !important;
  font-family: var(--cp-font-body);
}

/* 组件库（TDesign）：对话框风格与应用一致 */
.t-dialog {
  background: var(--cp-panel) !important;
  border-color: var(--cp-border) !important;
  box-shadow: var(--cp-shadow) !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

/* 组件库（TDesign）：图标基线统一已由自绘 AppIcon 契约承担（见 shared/ui/AppIcon.vue） */

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

/* 组件库（TDesign）：Toast/Message */
.t-message {
  background: var(--cp-panel) !important;
  border: 1px solid var(--cp-border-light);
  box-shadow: var(--cp-shadow-soft) !important;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

/* emoji-picker-element 主题适配：跟随应用主题而非系统 prefers-color-scheme */
emoji-picker {
  --background: var(--cp-panel-solid);
  --border-color: var(--cp-border);
  --border-radius: 8px;
  --button-active-background: var(--cp-hover-bg-2);
  --button-hover-background: var(--cp-hover-bg);
  --category-font-color: var(--cp-text);
  --indicator-color: var(--cp-accent);
  --input-background: var(--cp-field-bg);
  --input-border-color: var(--cp-field-border);
  --input-font-color: var(--cp-text);
  --input-placeholder-color: var(--cp-field-placeholder);
  --outline-color: var(--cp-focus-border);
  /* 防止弹出窗口过高时超出视口被 Windows 窗口栏遮挡 */
  height: 360px;
  max-height: min(360px, calc(100vh - 180px));
}

/* 原生输入控件 */
input,
textarea,
select {
  &:focus {
    outline: none;
  }
}

/* 滚动条（更适配桌面端） */
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
