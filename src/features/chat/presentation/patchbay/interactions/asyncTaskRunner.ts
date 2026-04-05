/**
 * @fileoverview chat｜presentation 统一异步任务错误兜底。
 * @description 提供按 action 上报错误的 fire-and-forget 包装器。
 *
 * 这个工具的设计目的：
 * 1. 在 fire-and-forget 场景（即调用方不关心异步结果，只需要执行）中统一捕获错误
 * 2. 确保任何异常都不会被静默吞掉，至少会记录到日志
 * 3. 简化调用方代码，不需要每次都写 try-catch
 */

/**
 * 异步错误处理函数类型。
 * 参数：
 * - action: 错误发生在哪一个动作上，用于日志定位
 * - error: 错误对象，可能是 Error 也可能是任意值
 */
export type AsyncErrorHandler = (action: string, error: unknown) => void;

/**
 * fire-and-forget 异步任务执行器类型。
 * 接受一个 Promise 任务和动作名称，执行后自动兜底错误。
 */
export type AsyncTaskRunner = (task: Promise<unknown>, action: string) => void;

/**
 * 创建异步任务兜底执行器。
 *
 * 工作机制：
 * 1. 返回一个函数包装异步任务
 * 2. 如果 Promise rejected，调用 onAsyncError 上报错误
 * 3. 不会让未捕获的 Promise rejection 逃逸
 * 4. 使用 void 标记我们不关心任务的最终结果，符合 fire-and-forget 语义
 *
 * @param onAsyncError - 统一错误上报函数（通常是打日志）
 * @returns fire-and-forget 异步执行器
 */
export function createAsyncTaskRunner(onAsyncError: AsyncErrorHandler): AsyncTaskRunner {
  return (task, action) => {
    // 对异步任务添加 catch 兜底，确保异常不会被静默吞掉
    void task.catch((error) => onAsyncError(action, error));
  };
}
