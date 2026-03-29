/**
 * @fileoverview 共享 runtime lease 控制器。
 * @description
 * 收敛 feature 级 runtime ownership 状态机，避免多个 feature 复制相同的 lease 计数逻辑。
 */

export type RuntimeLease = {
  release(): Promise<void>;
};

type RuntimeLeaseControllerArgs = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

type RuntimeLeaseController = {
  acquireLease(): Promise<RuntimeLease>;
};

/**
 * 创建共享 runtime lease 控制器。
 *
 * 约定：
 * - 多个调用方共享同一个底层 runtime；
 * - 最后一个 lease 释放后，底层 runtime 才允许停止；
 * - 启动/停止中的并发调用会复用同一 Promise。
 */
export function createRuntimeLeaseController(
  args: RuntimeLeaseControllerArgs,
): RuntimeLeaseController {
  let leaseCount = 0;
  let running = false;
  let startPromise: Promise<void> | null = null;
  let stopPromise: Promise<void> | null = null;

  async function ensureStarted(): Promise<void> {
    if (running) return;
    if (stopPromise) await stopPromise;
    if (startPromise) return startPromise;
    startPromise = Promise.resolve()
      .then(() => args.start())
      .then(() => {
        running = true;
      })
      .finally(() => {
        startPromise = null;
      });
    return startPromise;
  }

  async function ensureStopped(): Promise<void> {
    if (!running) return;
    if (startPromise) await startPromise;
    if (stopPromise) return stopPromise;
    stopPromise = Promise.resolve()
      .then(() => args.stop())
      .finally(() => {
        running = false;
        stopPromise = null;
      });
    return stopPromise;
  }

  return {
    async acquireLease(): Promise<RuntimeLease> {
      await ensureStarted();
      leaseCount += 1;
      let released = false;
      return {
        async release(): Promise<void> {
          if (released) return;
          released = true;
          leaseCount = Math.max(0, leaseCount - 1);
          if (leaseCount === 0) {
            await ensureStopped();
          }
        },
      };
    },
  };
}
