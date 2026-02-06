/**
 * @fileoverview TCP 指令消息类型定义（route + data）。
 * @description `BaseAPI` 会将该结构序列化为 JSON 并通过 `TcpService` 发送。
 */
/**
 * TCP 指令消息的 data 段对象（JSON）。
 */
export type DataObject = Record<string, unknown>;

/**
 * TCP 指令消息（route + data）。
 */
export interface CommandMessage {
  /**
   * 指令路由（由服务端定义语义）。
   */
  route: string;
  /**
   * 可选 payload（JSON）。
   */
  data?: DataObject;
}
