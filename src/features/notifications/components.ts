/**
 * @fileoverview notifications Feature 对外共享 UI 组件（跨 Feature 组件访问边界）。
 * @description
 * 集中管理 notifications feature 公开给其他 feature 使用的 UI 组件。
 *
 * 约束：
 * - 仅 re-export presentation 组件，不包含业务逻辑；
 * - 跨 feature 导入应通过 `@/features/notifications/components`；
 * - 类型应优先从 `notifications/api-types.ts` 获取。
 */

export { default as NotificationBell } from "./presentation/components/NotificationBell.vue";
