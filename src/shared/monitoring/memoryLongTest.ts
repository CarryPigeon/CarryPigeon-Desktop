/**
 * @fileoverview 开发/诊断用内存长时间运行测试。
 *
 * @description
 * 该模块只在 dev 模式或诊断模式下使用，release 产物中不应包含。
 * 运行指定时长后输出内存趋势报告，用于检测内存泄漏。
 */

import { createLogger } from "@/shared/utils/logger";
import { getMemoryMonitor } from "./memoryMonitor";

const logger = createLogger("memory_long_test");

const DEFAULT_DURATION_MS = 30 * 60 * 1000; // 30 分钟
const PROGRESS_INTERVAL_MS = 60 * 1000; // 每分钟输出一次进度

/**
 * 运行内存长时间测试。
 *
 * @param durationMs - 测试持续时间（毫秒），默认 30 分钟
 * @returns 测试完成后输出报告
 */
export async function runMemoryLongTest(
  durationMs: number = DEFAULT_DURATION_MS,
): Promise<void> {
  const monitor = getMemoryMonitor();
  monitor.start();

  const startTime = Date.now();
  const endTime = startTime + durationMs;

  const progressTimer = window.setInterval(() => {
    const remainingMs = Math.max(0, endTime - Date.now());
    const elapsedMs = Date.now() - startTime;
    logger.info("Action: api_memory_long_test_progress", {
      elapsed_minutes: Math.floor(elapsedMs / 60000),
      remaining_minutes: Math.ceil(remainingMs / 60000),
      stats: monitor.getStats(),
    });
  }, PROGRESS_INTERVAL_MS);

  await new Promise<void>((resolve) => {
    window.setTimeout(() => {
      window.clearInterval(progressTimer);
      resolve();
    }, durationMs);
  });

  const stats = monitor.getStats();
  const trend = monitor.getTrendAnalysis();
  logger.info("Action: api_memory_long_test_completed", { stats, trend });
  monitor.stop();
}
