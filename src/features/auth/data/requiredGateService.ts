/**
 * @fileoverview requiredGateService.ts
 * @description Data-layer helper for required gate precheck (`POST /api/gates/required/check`).
 *
 * Why:
 * - Required Setup page needs a “Recheck” action that does not depend on login.
 * - Server is the source of truth for gate decision; client provides installed plugin declarations.
 *
 * API doc reference:
 * - See `docs/api/*` → `POST /api/gates/required/check`
 */

import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { getDeviceId } from "@/shared/utils/deviceId";
import { getPluginManagerPort } from "@/features/plugins/di/plugins.di";

type ApiRequiredCheckResponse = {
  missing_plugins: string[];
};

/**
 * Check required gate status without authenticating.
 *
 * @param serverSocket - Current server socket (used to derive HTTP origin).
 * @returns Missing plugin ids reported by the server.
 */
export async function checkRequiredGate(serverSocket: string): Promise<string[]> {
  const socket = serverSocket.trim();
  if (!socket) return [];

  const installed = await getPluginManagerPort().listInstalled(socket);
  const installed_plugins: Array<{ plugin_id: string; version: string }> = [];
  for (const p of installed) {
    const ok = Boolean(p.enabled) && p.status === "ok" && Boolean(p.currentVersion);
    if (!ok) continue;
    installed_plugins.push({ plugin_id: p.pluginId, version: p.currentVersion as string });
  }

  const client = new HttpJsonClient({ serverSocket: socket, apiVersion: 1 });
  const res = await client.requestJson<ApiRequiredCheckResponse>("POST", "/gates/required/check", {
    client: { device_id: getDeviceId(), installed_plugins },
  });
  const raw = Array.isArray(res?.missing_plugins) ? res.missing_plugins : [];
  const out: string[] = [];
  for (const x of raw) {
    const id = String(x).trim();
    if (id) out.push(id);
  }
  return out;
}
