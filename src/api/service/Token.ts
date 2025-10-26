import { BaseAPI } from "../BaseAPI";

export class TokenService extends BaseAPI {
    protected async create(token: string) {
        return await this.sendRequestWithResponse(
            "core/service/token/create",
            { token: token }
        );
    }
}