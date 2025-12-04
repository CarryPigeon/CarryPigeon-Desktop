import { BaseAPI } from "../BaseAPI";

export class Plugin extends BaseAPI {
    protected async getList(){
        return await this.send(
            String(),
            "core/server/plugin/list", {}, (data) => {
            if (typeof(data) === 'string') {
                return JSON.parse(data);
            }
        });
    }
}