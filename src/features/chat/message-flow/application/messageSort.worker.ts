/**
 * @fileoverview 消息排序 Web Worker。
 */

import {
  sortMessageStubs,
  type MessageSortRequest,
  type MessageSortResponse,
} from "./messageSort.logic";

self.onmessage = (event: MessageEvent<MessageSortRequest>) => {
  const { id, stubs } = event.data;
  const sorted = sortMessageStubs(stubs);
  self.postMessage({ id, sorted } satisfies MessageSortResponse);
};

export {};
