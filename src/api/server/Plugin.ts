import { BaseAPI } from "../BaseAPI";

export class Plugin extends BaseAPI {
    protected async getList(){
        return await this.sendRequestWithResponse("core/server/plugin/list", {}, (data:string) => {
            return JSON.parse(data);
        });
    }
}