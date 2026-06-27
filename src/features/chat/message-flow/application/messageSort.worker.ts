/**
 * @fileoverview 消息排序 Web Worker。
 */

import { sortMessageStubs, type MessageSortStub } from "./messageSort.logic";

self.onmessage = (event: MessageEvent<MessageSortStub[]>) => {
  const sorted = sortMessageStubs(event.data);
  self.postMessage(sorted);
};

export {};
