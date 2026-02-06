/**
 * @fileoverview 当前用户数据 store（userData.ts）。
 * @description 展示层 store：提供 UI 使用的“当前用户资料快照”。
 *
 * 架构说明（Clean Architecture）：
 * 该 store 属于 UI/展示层，保存渲染所需与少量 UI 决策所需的“当前用户”数据
 * （例如：判断“这是否是我发送的消息？”）。domain 层不应依赖该 store。
 *
 * 数据来源：
 * - 真实模式：由 API 响应 / Tauri bridge 事件写入。
 * - UI 预览：可能保持默认值；mock 逻辑会退化为确定性身份。
 */

import { reactive } from "vue";

/**
 * 当前用户资料的最小快照模型（展示层使用）。
 */
export type CurrentUser = {
  /**
   * 用户 id（Snowflake 字符串；保持为 string 以避免 JS 精度丢失）。
   */
  id: string;
  username: string;
  email: string;
  description: string;
};

/**
 * 用于全局展示层组件的响应式用户资料。
 *
 * 默认值表示“匿名/未登录”。
 *
 * @constant
 */
export const currentUser = reactive<CurrentUser>({
  id: "",
  username: "",
  email: "",
  description: "",
});

/**
 * 将部分用户字段合并到 `currentUser`。
 *
 * 该函数刻意保持宽容：仅当 `next` 中字段存在且类型符合预期时才写入。
 * 目的：上游 payload 不完整时，避免把已有字段覆盖为空值。
 *
 * @param next - 要更新的部分用户字段。
 */
export function setCurrentUser(next: Partial<CurrentUser>): void {
  if (typeof next.id === "string") currentUser.id = next.id;
  if (typeof next.username === "string") currentUser.username = next.username;
  if (typeof next.email === "string") currentUser.email = next.email;
  if (typeof next.description === "string") currentUser.description = next.description;
}
