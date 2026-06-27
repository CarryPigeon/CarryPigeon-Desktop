/**
 * @fileoverview 防抖(debounce) 与 节流(throttle) 工具。
 * @description
 * - debounce: 高频调用时只在"冷却期结束后"执行最后一次。
 * - throttle: 高频调用时保证"每冷却期至少执行一次（首次）"。
 */

// ---- debounce ----

/**
 * 创建一个防抖函数。
 * 在 `delay` 毫秒内连续调用只会执行最后一次。
 *
 * @param fn - 需要防抖的原始函数。
 * @param delay - 延迟毫秒数（默认 300）。
 * @returns 防抖后的函数（带 `.cancel()` 方法）。
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number = 300,
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>): void => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/**
 * 创建一个防抖函数（Promise 版本，返回 Promise）。
 * 每次调用都会返回一个新的 Promise，只有最后一次会真正执行并 resolve。
 *
 * @param fn - 需要防抖的异步函数。
 * @param delay - 延迟毫秒数。
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  delay: number = 300,
): { (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { resolve: (v: any) => void; reject: (e: unknown) => void } | null = null;

  const debounced = (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise((resolve, reject) => {
      if (timer !== null) clearTimeout(timer);
      if (pending) {
        pending.reject(new Error("debounce cancelled"));
      }
      pending = { resolve, reject };
      timer = setTimeout(() => {
        timer = null;
        const p = pending;
        pending = null;
        if (p) {
          try {
            Promise.resolve(fn(...args)).then(p.resolve, p.reject);
          } catch (e) {
            p.reject(e);
          }
        }
      }, delay);
    });
  };

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending) {
      pending.reject(new Error("debounce cancelled"));
      pending = null;
    }
  };

  return debounced;
}

// ---- throttle ----

/**
 * 创建一个节流函数。
 * 在 `interval` 毫秒内首次调用会立即执行，后续调用被忽略直到冷却结束。
 *
 * @param fn - 需要节流的原始函数。
 * @param interval - 间隔毫秒数（默认 300）。
 * @returns 节流后的函数（带 `.cancel()` 方法）。
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  interval: number = 300,
): { (...args: Parameters<T>): void; cancel: () => void } {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>): void => {
    const now = Date.now();
    const remaining = interval - (now - lastCall);

    lastArgs = args;

    if (remaining <= 0) {
      // 冷却已过，立即执行
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      lastCall = now;
      fn(...args);
    } else if (timer === null) {
      // 在冷却中，安排在剩余时间后执行
      timer = setTimeout(() => {
        timer = null;
        lastCall = Date.now();
        if (lastArgs !== null) {
          fn(...lastArgs);
          lastArgs = null;
        }
      }, remaining);
    }
  };

  throttled.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastArgs = null;
  };

  return throttled;
}
