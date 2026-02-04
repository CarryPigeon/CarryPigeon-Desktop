/**
 * @fileoverview chatWireEvents.ts
 * @description WebSocket event envelope types aligned with the chat protocol.
 *
 * This type describes the server-to-client event envelope on the WS stream.
 */

export type WsEventDto = {
  event_id: string;
  event_type: string;
  server_time: number;
  payload: unknown;
};
