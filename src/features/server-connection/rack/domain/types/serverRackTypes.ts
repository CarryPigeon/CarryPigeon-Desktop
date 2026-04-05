/**
 * @fileoverview serverRackTypes.ts
 * @description server-connection/rack｜领域类型：服务器机架类型定义。
 *
 * 说明：
 * - 定义服务器机架（rack）的领域数据结构；
 * - 包含单条机架记录格式与整体持久化状态。
 */

/**
 * 服务器机架条目。
 *
 * 存储单个服务器连接端点的元信息：
 * - id: 唯一标识符
 * - name: 显示名称
 * - serverSocket: 服务器 socket 地址
 * - pinned: 是否固定在列表顶部
 * - note: 备注信息
 * - tlsPolicy: TLS 验证策略
 * - tlsFingerprint: TLS 证书指纹（用于 trust_fingerprint 策略）
 * - notifyMode: 消息通知模式
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
 *
 * 存储所有服务器机架配置，用于本地持久化读写。
 */
export type StoredServerRacksState = {
  servers: ServerRackRecord[];
};
