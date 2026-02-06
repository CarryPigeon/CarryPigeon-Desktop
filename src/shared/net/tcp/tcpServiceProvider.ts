/**
 * @fileoverview TCP service provider（依赖倒置）。
 * @description
 * 背景：
 * - `src/shared/net/*` 不应直接依赖 `features/network/*`；
 * - 但部分基础设施（例如 TCP BaseAPI）需要“按 server socket 获取 TcpService 实例”；
 * - 通过 provider 注入的方式实现依赖倒置：network feature 注册 provider，shared 仅消费。
 */

/**
 * TCP service 的最小能力子集（BaseAPI 所需）。
 */
export type TcpServiceLike = {
  send(serverSocket: string, payload: string): Promise<void>;
  sendWithResponse(serverSocket: string, payload: string, onResponse: (raw: unknown) => void): Promise<void>;
};

/**
 * 获取 TcpService 实例的 provider。
 */
export type TcpServiceProvider = (serverSocket: string) => TcpServiceLike | null;

let provider: TcpServiceProvider | null = null;

/**
 * 注册 TcpService provider（由 network feature 调用）。
 *
 * @param next - provider 函数。
 */
export function setTcpServiceProvider(next: TcpServiceProvider): void {
  provider = next;
}

/**
 * 获取指定 socket 的 TcpService；未注册或不存在则返回 `null`。
 *
 * @param serverSocket - 服务器 socket。
 * @returns TcpServiceLike 或 `null`。
 */
export function getTcpService(serverSocket: string): TcpServiceLike | null {
  try {
    return provider ? provider(serverSocket) : null;
  } catch {
    return null;
  }
}

