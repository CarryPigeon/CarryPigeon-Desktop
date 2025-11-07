import { BaseAPI } from "../BaseAPI";

export class EmailService extends BaseAPI {
    protected async send(email:string) {
        return await this.send(
            "core/service/email/send",
            { email: email },
        );
    }
}