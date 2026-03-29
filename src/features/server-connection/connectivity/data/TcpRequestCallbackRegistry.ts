/**
 * @fileoverview TcpRequestCallbackRegistry.ts
 * @description server-connection/connectivity｜请求回调注册器（request id -> callback）。
 */

/**
 * 请求回调注册器（request id -> callback）。
 *
 * 用于 TCP request/response 风格调用的回包路由。
 */
export class TcpRequestCallbackRegistry {
  private callbacks = new Map<number, (data: unknown) => void>();
  private nextId = 1;

  private readonly MAX_ACTIVE_REQUESTS = 8_192;
  private readonly MAX_ID_VALUE = 2_147_483_647;

  public add(callback: (data: unknown) => void): number {
    const id = this.allocateId();
    this.callbacks.set(id, callback);
    return id;
  }

  public addOnce(callback: (data: unknown) => void): number {
    let id = -1;
    const wrapper = (data: unknown) => {
      try {
        callback(data);
      } finally {
        if (id !== -1) this.remove(id);
      }
    };
    id = this.add(wrapper);
    return id;
  }

  public remove(id: number): void {
    this.callbacks.delete(id);
  }

  public call(id: number, data: unknown): boolean {
    const callback = this.callbacks.get(id);
    if (!callback) return false;
    callback(data);
    return true;
  }

  public clear(): void {
    this.callbacks.clear();
    this.nextId = 1;
  }

  private allocateId(): number {
    if (this.callbacks.size >= this.MAX_ACTIVE_REQUESTS) {
      throw new Error(`Too many pending TCP callbacks: ${this.callbacks.size}`);
    }
    const maxAttempts = this.MAX_ACTIVE_REQUESTS + 1;
    for (let i = 0; i < maxAttempts; i += 1) {
      const candidateId = this.nextId;
      this.nextId += 1;
      if (this.nextId > this.MAX_ID_VALUE) this.nextId = 1;
      if (!this.callbacks.has(candidateId)) return candidateId;
    }
    throw new Error("Failed to allocate callback id");
  }
}
