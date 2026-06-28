/**
 * @fileoverview 消息排序纯逻辑。
 * @description 供主线程与 Web Worker 共享，不含任何浏览器或框架依赖。
 */

export type MessageSortStub = {
  id: string;
  timeMs: number;
};

export type MessageSortRequest = {
  id: string;
  stubs: MessageSortStub[];
};

export type MessageSortResponse = {
  id: string;
  sorted: MessageSortStub[];
};

export function compareMessageStubs(a: MessageSortStub, b: MessageSortStub): number {
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  return a.id.localeCompare(b.id);
}

export function sortMessageStubs(stubs: MessageSortStub[]): MessageSortStub[] {
  return [...stubs].sort(compareMessageStubs);
}
