/**
 * @fileoverview TDesign 内置图标自绘覆盖（tdIconOverrides.ts）。
 * @description TDesign 组件内部图标（输入框清除、密码显隐、对话框/抽屉关闭、Toast 状态、分页箭头）
 * 默认来自 tdesign-icons-vue-next（实心字形，风格与本仓描边线性图标不一致）。本模块把这些
 * TDesign 图标键映射到 `AppIcon` 自绘实现，经
 * `<t-config-provider :global-config="{ icon: TD_ICON_OVERRIDES }">` 全局生效
 * （TDesign 的 `useGlobalIcon` 读取 global-config.icon）。
 *
 * 兼容要点：
 * - 必须自带 `t-icon t-icon-<kebab>` class：TDesign 的 `.t-icon { width/height: 1em }`
 *   与 `.t-input__suffix-clear` 等选择器依赖该 class 完成布局与命中区域。
 * - 必须透传 attrs（class / style / onClick / onMousedown），否则 `t-input` 清除按钮会失去交互。
 * - 尺寸统一 `1em`，跟随 TDesign 容器的 font-size，与历史内置图标行为一致。
 */

import { defineComponent, h, type Component } from "vue";
import AppIcon from "@/shared/ui/AppIcon.vue";
import { ICON_STROKE_WIDTH } from "@/shared/ui/icons/lucide-sprite";

/** TDesign 图标键 → 自绘注册表 key。 */
const TD_ICON_KEY_MAP: Readonly<Record<string, string>> = {
  CloseIcon: "close",
  CloseCircleFilledIcon: "close-circle",
  CheckCircleFilledIcon: "circle-check",
  ErrorCircleFilledIcon: "error-circle",
  InfoCircleFilledIcon: "info-circle",
  HelpCircleFilledIcon: "circle-help",
  BrowseIcon: "browse",
  BrowseOffIcon: "browse-off",
  CalendarIcon: "calendar",
  ChevronLeftIcon: "chevron-left",
  ChevronRightIcon: "chevron-right",
  ChevronUpIcon: "chevron-up",
  ChevronDownIcon: "chevron-down",
  RoundIcon: "more",
};

/**
 * 把 TDesign 图标键转换为 class 后缀（`CloseCircleFilledIcon` → `close-circle-filled`）。
 *
 * @param iconKey - TDesign 图标键（PascalCase，以 Icon 结尾）。
 * @returns kebab-case class 后缀。
 */
function tdClassSuffix(iconKey: string): string {
  return iconKey
    .replace(/Icon$/u, "")
    .replace(/([a-z0-9])([A-Z])/gu, "$1-$2")
    .toLowerCase();
}

/**
 * 生成一个 TDesign 兼容图标组件（复用 AppIcon 自绘字形）。
 *
 * @param iconKey - TDesign 图标键。
 * @param appIconName - 自绘注册表 key。
 * @returns 可直接放进 global-config.icon 的组件。
 */
function createTdIcon(iconKey: string, appIconName: string): Component {
  return defineComponent({
    name: `Td${iconKey}`,
    inheritAttrs: false,
    setup(_props, { attrs }) {
      return () =>
        h(AppIcon, {
          ...attrs,
          name: appIconName,
          size: "1em",
          strokeWidth: ICON_STROKE_WIDTH,
          class: ["t-icon", `t-icon-${tdClassSuffix(iconKey)}`, attrs.class],
        });
    },
  });
}

/** 传给 `t-config-provider` 的 `global-config.icon` 覆盖表。 */
export const TD_ICON_OVERRIDES: Readonly<Record<string, Component>> = Object.fromEntries(
  Object.entries(TD_ICON_KEY_MAP).map(([iconKey, appIconName]) => [iconKey, createTdIcon(iconKey, appIconName)]),
);

/** 被覆盖的 TDesign 图标键（供完整性与回归测试断言）。 */
export const TD_ICON_OVERRIDE_KEYS: readonly string[] = Object.keys(TD_ICON_KEY_MAP);
