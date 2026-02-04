/**
 * @fileoverview 前端窗口级事件（跨组件交互）。
 * @description 通过 `window.dispatchEvent` 在组件之间传递文本插入/转发等行为。
 */
/**
 * @constant
 * @description 转发消息事件名（窗口级）。
 */
export const FORWARD_MESSAGE_EVENT = "carrypigeon:forward-message";

export type ForwardMessageEventDetail = {
  content: string;
};

/**
 * 派发窗口级“转发消息”事件。
 *
 * 使用方可监听 `FORWARD_MESSAGE_EVENT` 来实现自定义转发流程，避免组件之间的强耦合。
 *
 * @param content - 要转发的消息内容。
 */
export function dispatchForwardMessage(content: string): void {
  window.dispatchEvent(
    new CustomEvent<ForwardMessageEventDetail>(FORWARD_MESSAGE_EVENT, {
      detail: { content },
    }),
  );
}

/**
 * @constant
 * @description 插入文本事件名（窗口级）。
 */
export const INSERT_TEXT_EVENT = "carrypigeon:insert-text";

export type InsertTextMode = "append" | "prepend" | "replace";

export type InsertTextEventDetail = {
  content: string;
  mode?: InsertTextMode;
};

/**
 * 派发窗口级“插入文本”事件。
 *
 * 常见用例：
 * - 成员菜单 → “mention” 将 `@name` 插入编辑器。
 * - 转发动作将引用内容插入编辑器。
 *
 * @param content - 要插入的文本。
 * @param mode - 插入模式（默认 `"append"`）。
 */
export function dispatchInsertText(content: string, mode: InsertTextMode = "append"): void {
  window.dispatchEvent(
    new CustomEvent<InsertTextEventDetail>(INSERT_TEXT_EVENT, {
      detail: { content, mode },
    }),
  );
}

/**
 * @constant
 * @description 频道变化事件名（窗口级）。
 */
export const CHANNEL_CHANGED_EVENT = "carrypigeon:channel-changed";

export type ChannelChangedEventDetail = {
  cid: string;
  scope?: string;
};

/**
 * 派发窗口级“频道变化”事件。
 *
 * 用途：在不引入 live chat store 与管理页之间直接依赖的前提下，让二级管理页面与 WS 事件保持同步。
 *
 * @param cid - 频道 id。
 * @param scope - 变化范围（`messages|members|applications|bans|profile|...`）。
 */
export function dispatchChannelChanged(cid: string, scope?: string): void {
  const channelId = String(cid ?? "").trim();
  const s = String(scope ?? "").trim();
  if (!channelId) return;
  window.dispatchEvent(
    new CustomEvent<ChannelChangedEventDetail>(CHANNEL_CHANGED_EVENT, {
      detail: { cid: channelId, scope: s || undefined },
    }),
  );
}
