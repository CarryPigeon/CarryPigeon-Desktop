/**
 * @fileoverview serverPluginImpl.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";

export class Plugin extends BaseAPI {
    protected async getList(){
        return this.send("core/server/plugin/list", {}, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as unknown;
        });
    }
}
