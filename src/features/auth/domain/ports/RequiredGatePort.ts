/**
 * @fileoverview RequiredGatePort.ts
 * @description auth｜领域端口：RequiredGatePort。
 *
 * 用途：
 * - Required Setup 页面需要一个“不依赖登录态”的 gate recheck 能力；
 * - 该端口用于屏蔽 HTTP/mock 实现差异，并让 presentation 通过 usecase 调用而不是直接调用 data。
 */

/**
 * Required gate 端口（领域层）。
 */
export interface RequiredGatePort {
  /**
   * 在未认证状态下检查 required gate。
   *
   * @param serverSocket - 当前服务端 socket。
   * @returns 服务端返回的缺失插件 id 列表。
   */
  check(serverSocket: string): Promise<string[]>;
}

