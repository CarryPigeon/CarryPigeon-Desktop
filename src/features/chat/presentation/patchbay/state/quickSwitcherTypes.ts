/**
 * @fileoverview Quick Switcher 共享视图模型类型。
 * @description chat｜presentation shared type：供 overlay 组件与 orchestration composable 共用的轻量契约。
 */

export type QuickSwitcherItem = {
  kind: "server" | "channel" | "module" | "route";
  id: string;
  title: string;
  subtitle: string;
};
