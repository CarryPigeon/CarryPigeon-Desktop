/**
 * @fileoverview 自适应消息排序器。
 * @description 数据量超过阈值时使用 Web Worker，否则在主线程排序。
 */

import type { ChatMessage } from "@/features/chat/message-flow/domain/contracts";
import { compareMessageStubs, type MessageSortStub } from "./messageSort.logic";

export const DEFAULT_WORKER_SORT_THRESHOLD = 2000;

export type AdaptiveMessageSorterOptions = {
  /**
   * 触发 Worker 的消息数量阈值（默认 2000）。
   */
  threshold?: number;
  /**
   * Worker 工厂，便于测试注入 mock。
   */
  createWorker?: () => Worker;
};

export function createAdaptiveMessageSorter(options?: AdaptiveMessageSorterOptions) {
  const threshold = options?.threshold ?? DEFAULT_WORKER_SORT_THRESHOLD;
  const hasCustomWorker = !!options?.createWorker;
  const createWorker =
    options?.createWorker ??
    (() => new Worker(new URL("./messageSort.worker.ts", import.meta.url)));
  let worker: Worker | null = null;

  function getWorker(): Worker {
    if (!worker) worker = createWorker();
    return worker;
  }

  function toStubs(messages: readonly ChatMessage[]): MessageSortStub[] {
    return messages.map((m) => ({ id: m.id, timeMs: m.timeMs }));
  }

  function sortOnMainThread(messages: readonly ChatMessage[]): ChatMessage[] {
    return [...messages].sort((a, b) =>
      compareMessageStubs({ id: a.id, timeMs: a.timeMs }, { id: b.id, timeMs: b.timeMs }),
    );
  }

  function sortOnWorker(messages: readonly ChatMessage[]): Promise<ChatMessage[]> {
    return new Promise((resolve) => {
      try {
        const stubs = toStubs(messages);
        const w = getWorker();

        function handleMessage(event: MessageEvent<MessageSortStub[]>) {
          cleanup();
          const order = new Map(event.data.map((stub, index) => [stub.id, index]));
          const sorted = [...messages].sort(
            (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
          );
          resolve(sorted);
        }

        function handleError(_event: ErrorEvent) {
          cleanup();
          // Worker 可能已失效，下次排序时重新创建。
          if (worker === w) {
            worker = null;
          }
          resolve(sortOnMainThread(messages));
        }

        function cleanup() {
          w.removeEventListener("message", handleMessage);
          w.removeEventListener("error", handleError);
        }

        w.addEventListener("message", handleMessage);
        w.addEventListener("error", handleError);
        w.postMessage(stubs);
      } catch {
        // createWorker() 抛出或其他同步失败：清理缓存并回退到主线程。
        if (worker) {
          try {
            worker.terminate();
          } catch {
            // ignore
          }
          worker = null;
        }
        resolve(sortOnMainThread(messages));
      }
    });
  }

  return {
    sort(messages: readonly ChatMessage[]): Promise<ChatMessage[]> {
      if (messages.length <= threshold || (typeof Worker === "undefined" && !hasCustomWorker)) {
        return Promise.resolve(sortOnMainThread(messages));
      }
      return sortOnWorker(messages);
    },
    terminate(): void {
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },
  };
}
