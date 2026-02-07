/**
 * @fileoverview localServerRackStatePort.ts
 * @description servers｜数据层实现：localServerRackStatePort。
 */

import { MOCK_SERVER_SOCKET } from "@/shared/config/runtime";
import { selectByMockEnabled } from "@/shared/config/mockModeSelector";
import { readJson, writeJson } from "@/shared/utils/localStore";
import { MOCK_KEYS } from "@/shared/mock/mockKeys";
import type { ServerRackStatePort, StoredServerRacksState } from "../domain/ports/ServerRackStatePort";

/**
 * localStorage 版本的 ServerRackStatePort。
 *
 * @constant
 */
export const localServerRackStatePort: ServerRackStatePort = {
  read(): StoredServerRacksState {
    return readJson<StoredServerRacksState>(MOCK_KEYS.serversState, {
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
  },
  write(state: StoredServerRacksState): void {
    writeJson(MOCK_KEYS.serversState, state);
  },
};

