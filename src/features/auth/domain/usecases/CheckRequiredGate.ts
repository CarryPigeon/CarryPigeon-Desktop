/**
 * @fileoverview CheckRequiredGate.ts
 * @description auth｜用例：CheckRequiredGate。
 */

import type { RequiredGatePort } from "../ports/RequiredGatePort";

/**
 * Required gate 预检用例（未登录态）。
 */
export class CheckRequiredGate {
  constructor(private readonly gate: RequiredGatePort) {}

  /**
   * 执行 required gate 检查。
   *
   * @param serverSocket - 当前服务端 socket。
   * @returns 缺失插件 id 列表。
   */
  execute(serverSocket: string): Promise<string[]> {
    return this.gate.check(serverSocket);
  }
}

