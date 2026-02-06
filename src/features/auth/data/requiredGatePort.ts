/**
 * @fileoverview requiredGatePort.ts
 * @description auth｜数据层实现：RequiredGatePort（required gate 预检）。
 *
 * API 文档：
 * - 见 `docs/api/*` → `POST /api/gates/required/check`
 *
 * 说明：
 * - 该能力允许在“未登录态”下向服务端确认 required gate 是否已满足；
 * - 请求体会携带客户端已安装且启用的插件声明，供服务端决策放行与否。
 */

import type { RequiredGatePort } from "../domain/ports/RequiredGatePort";
import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { getDeviceId } from "@/shared/utils/deviceId";
import { getPluginManagerPort } from "@/features/plugins/api";

type ApiRequiredCheckResponse = {
  missing_plugins: string[];
};

/**
 * RequiredGatePort 的 HTTP 实现。
 *
 * @constant
 */
export const requiredGatePort: RequiredGatePort = {
  async check(serverSocket: string): Promise<string[]> {
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
  },
};
