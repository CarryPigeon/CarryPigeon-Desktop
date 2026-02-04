/**
 * @fileoverview chatEventsPort.ts
 * @description Domain port: chat event stream connection (push-based).
 *
 * Notes:
 * - This port abstracts the push channel (typically WebSocket).
 * - The connect method is intentionally narrow: the store drives reauth/close
 *   based on session changes and UI lifecycle.
 */

import type { WsEventDto } from "../types/chatWireEvents";

export type ChatEventsClient = {
  /**
   * Close the underlying connection and stop timers.
   */
  close(): void;
  /**
   * Re-authenticate the connection with a new access token.
   *
   * @param nextAccessToken - New access token.
   */
  reauth(nextAccessToken: string): void;
};

export type ChatEventsConnectOptions = {
  /**
   * Optional explicit WS endpoint returned by `GET /api/server` (`ws_url`).
   *
   * When provided, the client should prefer it over the default `${origin}/api/ws`
   * construction to support custom WS routing.
   */
  wsUrlOverride?: string;
  /**
   * Called when the server reports resume is not possible; the client must
   * catch up via request/response APIs.
   */
  onResumeFailed?: (reason: string) => void;
  /**
   * Called when the server rejects auth/reauth; the client should refresh and/or reconnect.
   */
  onAuthError?: (reason: string) => void;
};

export type ChatEventsPort = {
  /**
   * Connect to the chat event stream and authenticate.
   *
   * @param serverSocket - Server socket used to derive origin.
   * @param accessToken - Bearer access token.
   * @param onEvent - Event envelope callback.
   * @param options - Optional connection callbacks.
   * @returns Client handle.
   */
  connect(
    serverSocket: string,
    accessToken: string,
    onEvent: (evt: WsEventDto) => void,
    options?: ChatEventsConnectOptions,
  ): ChatEventsClient;
};
