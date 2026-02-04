/**
 * @fileoverview messageReceiveService.ts
 * @description Presentation boundary for incoming server messages (placeholder for UI preview).
 */

import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("messageReceiveService");

/**
 * Presentation-level entry point for incoming server messages.
 *
 * In the real app, this should push events into a domain-level message pipeline
 * (e.g. normalize → persist → update UI stores). For now it's a placeholder so
 * the TCP layer has a safe sink.
 *
 * @constant
 */
export const messageReceiveService = {
  showNewMessage(payload: unknown, ctx: { serverSocket: string }): void {
    logger.debug("Incoming message (unwired)", { serverSocket: ctx.serverSocket, payload });
  },
};
