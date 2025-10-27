import { BaseAPI } from "../BaseAPI";

export class Data extends BaseAPI {
    protected async getData() {
        return await this.sendRequestWithResponse("core/server/data/get", {}, (data) => {
            return JSON.parse(data);
        });
    }
}