/**
 * @fileoverview userApiImpl.ts 文件职责说明。
 */
import { BaseAPI } from "../../../shared/net/BaseAPI";

export class UserService extends BaseAPI {
    /**
     * register method.
     * @param email - TODO.
     * @param code - TODO.
     * @returns TODO.
     */
    async register(email: string, code: string) {
        return this.send("core/user/register", { email, code }, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return String(parsed["token"] ?? "");
        });
    }

    /**
     * loginByEmail method.
     * @param email - TODO.
     * @param code - TODO.
     * @returns TODO.
     */
    async loginByEmail(email: string, code: string) {
        return this.send("core/user/login/email", { email, code }, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return String(parsed["token"] ?? "");
        });
    }

    /**
     * loginByToken method.
     * @param token - TODO.
     * @returns TODO.
     */
    async loginByToken(token: string) {
        return this.send("core/user/login/token", { token }, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            return {
                token: String(parsed["token"] ?? ""),
                uid: Number(parsed["uid"] ?? 0),
            };
        });
    }

    /**
     * logoutToken method.
     * @param token - TODO.
     * @returns TODO.
     */
    async logoutToken(token: string) {
        return this.send("core/user/login/token/logout", { token });
    }

    /**
     * getUserProfile method.
     * @param uid - TODO.
     * @returns TODO.
     */
    async getUserProfile(uid: number) {
        return this.send("core/user/profile/get", { uid }, (data) => {
            const raw = typeof data === "string" ? data : JSON.stringify(data);
            return JSON.parse(raw) as Record<string, unknown>;
        });
    }

    /**
     * updateUserProfile method.
     * @param username - TODO.
     * @param avatar - TODO.
     * @param sex - TODO.
     * @param brief - TODO.
     * @param birthday - TODO.
     * @returns TODO.
     */
    async updateUserProfile(username: string, avatar: number, sex: number, brief: string, birthday: number) {
        return this.send("core/user/profile/update", { username, avatar, sex, brief, birthday });
    }

    /**
     * updateUserEmail method.
     * @param new_email - TODO.
     * @param code - TODO.
     * @returns TODO.
     */
    async updateUserEmail(new_email: string, code: string) {
        return this.send("core/user/profile/update/email", { new_email, code });
    }
}
