import {BaseAPI} from "../BaseAPI";

export class User extends BaseAPI{
    protected async register(email: string, code: string){
        return await this.send("core/user/register",
            {email: email, code: code},
            (data) => {
                if (JSON.parse(<string>data)["token"] != undefined){
                    return JSON.parse(<string>data)["token"];
                } //else  TODO：弹窗提示注册失败
            }
        );
    }
    protected async loginByEmail (token: string){
        return await this.send("core/user/login/email",
            {token: token},
            (data) => {
            if (JSON.parse(<string>data)["msg"] == undefined){
                return JSON.parse(<string>data)["msg"];
            } //else  TODO：弹窗提示登录失败
            }
            );
    }
    protected async loginByToken(token: string) {
        return await this.send(
            "core/user/login/token",
            {token: token},
            (data) => {
                if (JSON.parse(<string>data)["msg"] == undefined){
                    return JSON.parse(<string>data)["msg"];
                } //else  TODO：弹窗提示登录失败
            }
        );
     }
    protected async logoutToken(token: string) {
        return await this.send(
            "core/user/token/logout",
            {token: token}
        );
    }
    protected async getUserProfile(uid: string) {
        return await this.send(
            "core/user/profile/" + uid,
            {uid: uid},
            (data) => {
                return JSON.parse(<string>data);
            }
        );
    }
    protected async updateUserProfile(username: string, avatar: string, sex: number, brief: string, birthday: string) {
        return await this.send(
            "core/user/profile/update",
            {username: username, avatar: avatar, sex: sex, brief: brief, birthday: birthday},
        );
     }
    protected async updateUserEmail(new_email: string, code: string) {
        return await this.send(
            "core/user/email/update",
            {new_email: new_email, code: code},
        );
     }
}
