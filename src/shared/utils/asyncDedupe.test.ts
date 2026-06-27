// src/shared/utils/asyncDedupe.test.ts
import { describe, it, expect, vi } from 'vitest';
import { dedupeAsyncByKey } from './asyncDedupe';

describe('asyncDedupe', () => {
  it('dedupes concurrent calls with the same key', async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return 'ok';
    });
    const [a, b] = await Promise.all([
      dedupeAsyncByKey('k1', fn),
      dedupeAsyncByKey('k1', fn),
    ]);
    expect(a).toBe('ok');
    expect(b).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows sequential calls after the first completes', async () => {
    const fn = vi.fn(async () => 'ok');
    await dedupeAsyncByKey('k2', fn);
    await dedupeAsyncByKey('k2', fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not dedupe different keys', async () => {
    const fn = vi.fn(async () => 'ok');
    await Promise.all([
      dedupeAsyncByKey('k3', fn),
      dedupeAsyncByKey('k4', fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('returns fn() directly for empty key', async () => {
    const fn = vi.fn(async () => 'ok');
    const result = await dedupeAsyncByKey('', fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
