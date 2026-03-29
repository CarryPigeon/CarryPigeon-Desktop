/**
 * @fileoverview HandshakeWaitState.ts
 * @description server-connection/connectivity｜握手等待状态容器（复用、超时、清理）。
 */

/**
 * 管理握手等待状态：
 * - 单次等待 Promise 复用
 * - 超时 reject
 * - 成功/失败后统一清理
 */
export class HandshakeWaitState {
  private resolver: (() => void) | undefined;
  private rejecter: ((reason?: unknown) => void) | undefined;
  private timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  private pendingPromise: Promise<void> | null = null;

  public wait(isHandshakeComplete: () => boolean, timeoutMs: number): Promise<void> {
    if (isHandshakeComplete()) return Promise.resolve();
    if (this.pendingPromise) return this.pendingPromise;

    this.pendingPromise = new Promise((resolve, reject) => {
      this.resolver = resolve;
      this.rejecter = reject;
      this.timeoutHandle = setTimeout(() => {
        if (this.rejecter) {
          this.rejecter(new Error("Key exchange timeout"));
          this.cleanup();
        }
      }, timeoutMs);
    });
    return this.pendingPromise;
  }

  public resolveIfPending(onResolveError?: (error: unknown) => void): void {
    if (!this.resolver) return;
    try {
      this.resolver();
    } catch (error) {
      if (this.rejecter) this.rejecter(error);
      onResolveError?.(error);
    } finally {
      this.cleanup();
    }
  }

  public rejectIfPending(reason: unknown): void {
    if (this.rejecter) {
      this.rejecter(reason);
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
    this.resolver = undefined;
    this.rejecter = undefined;
    this.pendingPromise = null;
  }
}
