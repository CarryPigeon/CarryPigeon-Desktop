/**
 * @fileoverview latest-wins 异步控制器。
 * @description
 * 为“新命令覆盖旧命令”的异步流程提供共享 generation 控制，避免手写分散的 latest-wins 逻辑。
 */

type LatestAsyncController = {
  begin(): number;
  isCurrent(token: number): boolean;
};

/**
 * 创建 latest-wins 异步控制器。
 *
 * 说明：
 * - 每次 `begin()` 都会让之前的 token 失效；
 * - 调用方应在异步边界后使用 `isCurrent(token)` 判断结果是否仍可提交。
 */
export function createLatestAsyncController(): LatestAsyncController {
  let currentToken = 0;
  return {
    begin(): number {
      currentToken += 1;
      return currentToken;
    },
    isCurrent(token: number): boolean {
      return token === currentToken;
    },
  };
}
