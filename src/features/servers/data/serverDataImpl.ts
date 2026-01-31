/**
 * @fileoverview serverDataImpl.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";

export type ServerData = {
    server_name?: string;
    avatar?: string;
    brief?: string;
    time?: number;
};

export class ServerDataService extends BaseAPI {
    /**
     * getServerData method.
     * @returns TODO.
     */
    async getServerData(): Promise<ServerData> {
        return this.send("core/server/data/get", {}, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as ServerData;
        });
    }
}

// Backwards-compatible alias (legacy naming).
export class Data extends ServerDataService {}
