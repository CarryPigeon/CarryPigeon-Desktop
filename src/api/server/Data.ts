import { BaseAPI } from "../BaseAPI";

export class Data extends BaseAPI {
    protected async getData() {
        return await this.send(
            0,
            "core/server/data/get", {}, (data) => {
            return JSON.parse(<string>data);
        });
    }
}