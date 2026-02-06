/**
 * @fileoverview requiredGateService.ts
 * @description auth｜数据层实现：requiredGateService。
 *
 * 背景：
 * - Required Setup 页面需要一个不依赖登录态的“Recheck”动作。
 * - Gate 决策以服务端为准；客户端仅提供已安装插件声明，供服务端判定是否放行。
 *
 * API 文档：
 * - 见 `docs/api/*` → `POST /api/gates/required/check`
 */

import { requiredGatePort } from "@/features/auth/data/requiredGatePort";

/**
 * 在未认证状态下检查 required gate。
 *
 * @param serverSocket - 当前服务端 socket（用于推导 HTTP origin）。
 * @returns 服务端返回的缺失插件 id 列表。
 */
export async function checkRequiredGate(serverSocket: string): Promise<string[]> {
  return requiredGatePort.check(serverSocket);
}
