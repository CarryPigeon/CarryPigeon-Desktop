import { BaseAPI } from "../BaseAPI";

export class TokenService extends BaseAPI {
    protected async create(token: string) {
        return await this.send(
            "core/service/token/create",
            { token: token }
        );
    }
}