/**
 * @fileoverview CheckRequiredGate.ts
 * @description account/auth-flow｜用例：CheckRequiredGate。
 */

import type { RequiredGatePort } from "../ports/RequiredGatePort";

/**
 * Required gate 预检用例（未登录态）。
 */
export class CheckRequiredGate {
  constructor(
    private readonly gate: RequiredGatePort,
    private readonly serverSocket: string,
  ) {}

  /**
   * 执行 required gate 检查。
   *
   * @returns 缺失插件 id 列表。
   */
  execute(): Promise<string[]> {
    return this.gate.check(this.serverSocket);
  }
}
