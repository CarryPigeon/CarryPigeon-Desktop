import { describe, it, expect, vi } from 'vitest';
import { createAdaptiveMessageSorter } from './adaptiveMessageSorter';

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

    const messageHandler = addEventListener.mock.calls.find(
      (call) => call[0] === 'message',
    )?.[1] as (event: MessageEvent<{ id: string; timeMs: number }[]>) => void;

    messageHandler({ data: [{ id: 'a', timeMs: 100 }, { id: 'b', timeMs: 200 }, { id: 'c', timeMs: 200 }] } as any);

    const sorted = await promise;
    expect(sorted.map((m) => m.id)).toEqual(['a', 'b', 'c']);
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
