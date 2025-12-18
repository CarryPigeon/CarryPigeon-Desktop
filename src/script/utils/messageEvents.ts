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
