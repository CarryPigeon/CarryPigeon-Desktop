import { BaseAPI } from "../BaseAPI";

export class EmailService extends BaseAPI {
    protected async emailServiceSend(email:string) {
        return await this.send(
            String(),
            "core/service/email/send",
            { email: email },
        );
    }
}