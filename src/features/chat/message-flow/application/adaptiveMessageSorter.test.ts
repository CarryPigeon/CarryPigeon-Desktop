import { describe, it, expect, vi } from 'vitest';
import { createAdaptiveMessageSorter } from './adaptiveMessageSorter';
import type { MessageSortStub } from './messageSort.logic';

describe('adaptiveMessageSorter', () => {
  it('sorts on main thread when under threshold', async () => {
    const sorter = createAdaptiveMessageSorter({ threshold: 10 });
    const messages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
      { id: 'c', timeMs: 200 },
    ] as any;
    const sorted = await sorter.sort(messages);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts using worker when over threshold', async () => {
    const postMessage = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mockWorker = {
      postMessage,
      addEventListener,
      removeEventListener,
    } as unknown as Worker;

    const createWorker = vi.fn(() => mockWorker);
    const sorter = createAdaptiveMessageSorter({ threshold: 2, createWorker });

    const messages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
      { id: 'c', timeMs: 200 },
    ] as any;

    const promise = sorter.sort(messages);
    expect(createWorker).toHaveBeenCalledTimes(1);

    const postedRequest = postMessage.mock.calls[0][0] as { id: string; stubs: MessageSortStub[] };

    const messageHandler = addEventListener.mock.calls.find(
      (call) => call[0] === 'message',
    )?.[1] as (event: MessageEvent<{ id: string; sorted: MessageSortStub[] }>) => void;

    messageHandler({
      data: {
        id: postedRequest.id,
        sorted: [
          { id: 'a', timeMs: 100 },
          { id: 'b', timeMs: 200 },
          { id: 'c', timeMs: 200 },
        ],
      },
    } as any);

    const sorted = await promise;
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('correlates concurrent worker responses by request id', async () => {
    const postMessage = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mockWorker = {
      postMessage,
      addEventListener,
      removeEventListener,
    } as unknown as Worker;

    const createWorker = vi.fn(() => mockWorker);
    const sorter = createAdaptiveMessageSorter({ threshold: 2, createWorker });

    const firstMessages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
      { id: 'c', timeMs: 200 },
    ] as any;
    const secondMessages = [
      { id: 'z', timeMs: 300 },
      { id: 'x', timeMs: 100 },
      { id: 'y', timeMs: 200 },
    ] as any;

    const firstPromise = sorter.sort(firstMessages);
    const secondPromise = sorter.sort(secondMessages);

    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(2);

    const requestIds = postMessage.mock.calls.map(
      (call) => (call[0] as { id: string; stubs: MessageSortStub[] }).id,
    );
    expect(new Set(requestIds).size).toBe(2);

    const messageHandlers = addEventListener.mock.calls
      .filter((call) => call[0] === 'message')
      .map((call) => call[1]) as ((event: MessageEvent<{ id: string; sorted: MessageSortStub[] }>) => void)[];

    // Fire second response first to verify correlation, not arrival order.
    messageHandlers[1]({
      data: {
        id: requestIds[1],
        sorted: [
          { id: 'x', timeMs: 100 },
          { id: 'y', timeMs: 200 },
          { id: 'z', timeMs: 300 },
        ],
      },
    } as any);

    messageHandlers[0]({
      data: {
        id: requestIds[0],
        sorted: [
          { id: 'a', timeMs: 100 },
          { id: 'b', timeMs: 200 },
          { id: 'c', timeMs: 200 },
        ],
      },
    } as any);

    const [firstResult, secondResult] = await Promise.all([firstPromise, secondPromise]);
    expect(firstResult.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(secondResult.map((m) => m.id)).toEqual(['x', 'y', 'z']);
  });

  it('falls back to main thread when Worker is unavailable', async () => {
    const originalWorker = globalThis.Worker;
    // @ts-expect-error Worker may be undefined in some environments
    globalThis.Worker = undefined;
    const sorter = createAdaptiveMessageSorter({ threshold: 2 });
    const messages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
    ] as any;
    const sorted = await sorter.sort(messages);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b']);
    globalThis.Worker = originalWorker;
  });

  it('falls back to main thread when worker emits an error', async () => {
    const postMessage = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const mockWorker = {
      postMessage,
      addEventListener,
      removeEventListener,
    } as unknown as Worker;

    const createWorker = vi.fn(() => mockWorker);
    const sorter = createAdaptiveMessageSorter({ threshold: 2, createWorker });

    const messages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
      { id: 'c', timeMs: 200 },
    ] as any;

    const promise = sorter.sort(messages);
    expect(createWorker).toHaveBeenCalledTimes(1);

    const errorHandler = addEventListener.mock.calls.find(
      (call) => call[0] === 'error',
    )?.[1] as (event: ErrorEvent) => void;

    errorHandler({} as any);

    const sorted = await promise;
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to main thread when createWorker throws', async () => {
    const createWorker = vi.fn(() => {
      throw new Error('worker creation failed');
    });
    const sorter = createAdaptiveMessageSorter({ threshold: 2, createWorker });

    const messages = [
      { id: 'b', timeMs: 200 },
      { id: 'a', timeMs: 100 },
      { id: 'c', timeMs: 200 },
    ] as any;

    const sorted = await sorter.sort(messages);
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
  });

  it('terminates the cached worker', () => {
    const terminate = vi.fn();
    const mockWorker = {
      terminate,
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as Worker;

    const createWorker = vi.fn(() => mockWorker);
    const sorter = createAdaptiveMessageSorter({ threshold: 1, createWorker });

    sorter.sort([
      { id: 'a', timeMs: 100 },
      { id: 'b', timeMs: 200 },
    ] as any);
    expect(createWorker).toHaveBeenCalledTimes(1);

    sorter.terminate();
    expect(terminate).toHaveBeenCalledTimes(1);
  });
});
