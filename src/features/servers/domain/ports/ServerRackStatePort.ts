/**
 * @fileoverview ServerRackStatePort.ts
 * @description servers｜领域端口：ServerRackStatePort。
 */

/**
 * 服务器机架条目。
 */
export type ServerRackRecord = {
  id: string;
  name: string;
  serverSocket: string;
  pinned: boolean;
  note: string;
  tlsPolicy: "strict" | "trust_fingerprint" | "insecure";
  tlsFingerprint: string;
  notifyMode: "notify" | "silent" | "none";
};

/**
 * 服务器机架持久化状态。
 */
export type StoredServerRacksState = {
  servers: ServerRackRecord[];
};

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

