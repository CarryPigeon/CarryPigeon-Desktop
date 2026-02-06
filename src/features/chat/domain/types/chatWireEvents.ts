/**
 * @fileoverview chatWireEvents.ts
 * @description chat｜领域类型：chatWireEvents。
 *
 * This type describes the server-to-client event envelope on the WS stream.
 */

export type WsEventDto = {
  event_id: string;
  event_type: string;
  server_time: number;
  payload: unknown;
};
