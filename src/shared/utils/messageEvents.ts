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
 * 触发“转发消息”事件。
 * @param content - 转发的文本内容
 */
/**
 * dispatchForwardMessage 方法说明。
 * @param content - 参数说明。
 * @returns 返回值说明。
 */
export function dispatchForwardMessage(content: string) {
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
 * 触发“插入文本”事件。
 * @param content - 要插入的文本
 * @param mode - 插入模式（默认 append）
 */
/**
 * dispatchInsertText 方法说明。
 * @param content - 参数说明。
 * @param mode - 参数说明。
 * @returns 返回值说明。
 */
export function dispatchInsertText(content: string, mode: InsertTextMode = "append") {
  window.dispatchEvent(
    new CustomEvent<InsertTextEventDetail>(INSERT_TEXT_EVENT, {
      detail: { content, mode },
    }),
  );
}
