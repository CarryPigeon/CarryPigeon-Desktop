import { BaseAPI } from "../BaseAPI";

export class Data extends BaseAPI {
    protected async getData() {
        return await this.send(
            String(),
            "core/server/data/get", {}, (data) => {
            return JSON.parse(<string>data);
        });
    }
}