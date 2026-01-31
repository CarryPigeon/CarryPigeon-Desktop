/**
 * @fileoverview TCP 指令消息类型定义（route + data）。
 * @description `BaseAPI` 会将该结构序列化为 JSON 并通过 `TcpService` 发送。
 */
export type DataObject = Record<string, unknown>;

export interface CommandMessage{
    route: string,
    data?: DataObject,
}
