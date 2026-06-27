// src/shared/utils/rateLimit.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, debounceAsync, throttle } from './rateLimit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('debounce only executes the last call after delay', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d('b');
    d('c');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('debounce cancel prevents execution', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
  });

  it('debounceAsync resolves with the last call result', async () => {
    const fn = vi.fn(async (x: string) => `r:${x}`);
    const d = debounceAsync(fn, 100);
    const p1 = d('a');
    const p2 = d('b');
    vi.advanceTimersByTime(100);
    await expect(p2).resolves.toBe('r:b');
    await expect(p1).rejects.toThrow('debounce cancelled');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throttle executes immediately then ignores calls within interval', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    t('b');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('b');
  });
});
