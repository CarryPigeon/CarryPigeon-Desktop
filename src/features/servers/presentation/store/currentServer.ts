/**
 * @fileoverview currentServer.ts
 * @description Presentation store: current selected server socket (rack).
 */

import { ref } from "vue";
import { MOCK_SERVER_SOCKET, USE_MOCK_API } from "@/shared/config/runtime";

/**
 * The currently selected server socket.
 *
 * In mock mode we default to a deterministic mock socket so that UI can be
 * previewed without manual setup.
 *
 * @constant
 */
export const currentServerSocket = ref<string>(USE_MOCK_API ? MOCK_SERVER_SOCKET : "");

/**
 * Update the current server socket (trimmed).
 *
 * This is a purely presentation-layer concern: it drives which per-server
 * stores are used (plugins catalog/install, chat mock data, etc.).
 *
 * @param next - New server socket string.
 */
export function setServerSocket(next: string): void {
  currentServerSocket.value = next.trim();
}
