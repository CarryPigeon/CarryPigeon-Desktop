/**
 * @fileoverview tokenServiceImpl.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";

export class TokenService extends BaseAPI {
    protected async create(token: string) {
        return this.send("core/service/token/create", { token });
    }
}
