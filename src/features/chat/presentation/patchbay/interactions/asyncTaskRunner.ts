/**
 * @fileoverview chat｜presentation composable：统一异步任务错误兜底。
 * @description 提供按 action 上报错误的 fire-and-forget 包装器。
 */

export type AsyncErrorHandler = (action: string, error: unknown) => void;

/**
 * fire-and-forget 异步任务执行器。
 */
export type AsyncTaskRunner = (task: Promise<unknown>, action: string) => void;

/**
 * 创建异步任务兜底执行器。
 *
 * @param onAsyncError - 统一错误上报函数。
 * @returns fire-and-forget 异步执行器。
 */
export function createAsyncTaskRunner(onAsyncError: AsyncErrorHandler): AsyncTaskRunner {
  return (task, action) => {
    void task.catch((error) => onAsyncError(action, error));
  };
}
