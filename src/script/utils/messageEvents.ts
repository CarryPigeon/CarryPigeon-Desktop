export const FORWARD_MESSAGE_EVENT = 'carrypigeon:forward-message';

export type ForwardMessageEventDetail = {
  content: string;
};

export function dispatchForwardMessage(content: string) {
  window.dispatchEvent(
    new CustomEvent<ForwardMessageEventDetail>(FORWARD_MESSAGE_EVENT, {
      detail: { content },
    }),
  );
}

export const INSERT_TEXT_EVENT = 'carrypigeon:insert-text';

export type InsertTextMode = 'append' | 'prepend' | 'replace';

export type InsertTextEventDetail = {
  content: string;
  mode?: InsertTextMode;
};

export function dispatchInsertText(content: string, mode: InsertTextMode = 'append') {
  window.dispatchEvent(
    new CustomEvent<InsertTextEventDetail>(INSERT_TEXT_EVENT, {
      detail: { content, mode },
    }),
  );
}
