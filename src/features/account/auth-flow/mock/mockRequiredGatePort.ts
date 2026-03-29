/**
 * @fileoverview mockRequiredGatePort.ts
 * @description account/auth-flow｜Mock 实现：required gate 预检。
 */

import { MOCK_DISABLE_REQUIRED_GATE, MOCK_LATENCY_MS } from "@/shared/config/runtime";
import { sleep } from "@/shared/mock/sleep";
import { MOCK_PLUGIN_CATALOG } from "@/shared/mock/mockPluginCatalog";
import { getMockPluginsState } from "@/shared/mock/mockPluginState";
import type { RequiredGatePort } from "../domain/ports/RequiredGatePort";

/**
 * 创建 `RequiredGatePort` 的 mock 实现。
 *
 * @returns `RequiredGatePort`。
 */
export function createMockRequiredGatePort(): RequiredGatePort {
  return {
    async check(serverSocket: string): Promise<string[]> {
      await sleep(MOCK_LATENCY_MS);
      if (MOCK_DISABLE_REQUIRED_GATE) return [];
      const requiredIds = MOCK_PLUGIN_CATALOG.filter((item) => item.required).map((item) => item.pluginId);
      const pluginState = getMockPluginsState(serverSocket);
      const missing: string[] = [];
      for (const id of requiredIds) {
        const ok = Boolean(pluginState[id]?.enabled) && pluginState[id]?.status === "ok";
        if (!ok) missing.push(id);
      }
      return missing;
    },
  };
}

