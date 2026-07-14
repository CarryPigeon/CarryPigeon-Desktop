/**
 * @fileoverview localServerRackStatePort.ts
 * @description server-connection/rack｜数据层实现：localServerRackStatePort。
 */

import { IS_MOCK_ENABLED, MOCK_SERVER_SOCKET } from "@/shared/config/runtime";
import { selectByMockEnabled } from "@/shared/config/mockModeSelector";
import { readJson, writeJson } from "@/shared/utils/localStore";
import { MOCK_KEYS } from "@/shared/mock/mockKeys";
import type { StoredServerRacksState } from "../domain/types/serverRackTypes";
import type { ServerRackStatePort } from "../domain/ports/ServerRackStatePort";

/**
 * 过滤掉 localStorage 中的 mock socket 机架记录。
 * 防止之前 mock 模式写入的数据在非 mock 模式下被使用。
 */
function filterMockRacks(state: StoredServerRacksState): StoredServerRacksState {
  if (IS_MOCK_ENABLED) return state;
  return {
    ...state,
    servers: state.servers.filter((r) => !r.serverSocket?.trim().toLowerCase().startsWith("mock://")),
  };
}

/**
 * localStorage 版本的 ServerRackStatePort。
 *
 * @constant
 */
export const localServerRackStatePort: ServerRackStatePort = {
  read(): StoredServerRacksState {
    const raw = readJson<StoredServerRacksState>(MOCK_KEYS.serversState, {
      servers: selectByMockEnabled(
        () => [
          {
            id: "rack-0",
            name: "Mock Rack",
            serverSocket: MOCK_SERVER_SOCKET,
            pinned: true,
            note: "",
            tlsPolicy: "strict",
            tlsFingerprint: "",
            notifyMode: "notify",
          },
        ],
        () => [],
      ),
    });
    return filterMockRacks(raw);
  },
  write(state: StoredServerRacksState): void {
    writeJson(MOCK_KEYS.serversState, state);
  },
};

