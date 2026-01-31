/**
 * @fileoverview emailServiceImpl.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";

export class EmailService extends BaseAPI {
    /**
     * sendCode method.
     * @param email - TODO.
     * @returns TODO.
     */
    async sendCode(email: string) {
        return this.send("core/service/email/send", { email });
    }
}
