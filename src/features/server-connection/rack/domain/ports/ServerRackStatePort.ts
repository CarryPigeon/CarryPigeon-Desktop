/**
 * @fileoverview ServerRackStatePort.ts
 * @description server-connection/rack｜领域端口：ServerRackStatePort。
 */

import type { StoredServerRacksState } from "../types/serverRackTypes";

/**
 * 服务器机架状态持久化端口。
 */
export interface ServerRackStatePort {
  /**
   * 读取持久化状态。
   *
   * @returns 持久化状态。
   */
  read(): StoredServerRacksState;

  /**
   * 写入持久化状态。
   *
   * @param state - 待持久化状态。
   * @returns 无返回值。
   */
  write(state: StoredServerRacksState): void;
}

