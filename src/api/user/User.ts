import {BaseAPI} from "../BaseAPI";

export class User extends BaseAPI{
    protected register(email: string, code: string){
        return this.sendRequestWithResponse("core/user/register",
            {email: email, code: code},
            (data) => {
                if (data["token"] != undefined){
                    return data["token"];
                } //else  TODO：弹窗提示注册失败
            }
        );
    }
    protected loginByEmail (token: string){
        return this.sendRequestWithResponse("core/user/login/email",
            {token: token},
            (data) => {
            if (data["msg"] == undefined){
                return data["msg"];
            } //else  TODO：弹窗提示登录失败
            }
            );
    }
    protected loginByToken(token: string) {
        return this.sendRequestWithResponse(
            "core/user/login/token",
            {token: token},
            (data) => {
                if (data["msg"] == undefined){
                    return data["msg"];
                } //else  TODO：弹窗提示登录失败
            }
        )
     }
    protected logoutToken(token: string) {
        return this.sendRequestWithResponse(
            "core/user/token/logout",
            {token: token}
        )
    }
    protected getUserProfile(uid: string) {
        return this.sendRequestWithResponse(
            "core/user/profile/" + uid,
            {uid: uid},
            (data) => {
                return JSON.parse(data);
            }
        )
    }
    protected updateUserProfile(username: string, avatar: string, sex: number, brief: string, brithday: string) {
        return this.sendRequestWithResponse(
            "core/user/profile/update",
            {username: username, avatar: avatar, sex: sex, brief: brief, brithday: brithday},
        )
     }
    protected updateUserEmail(new_email: string, code: string) {
        return this.sendRequestWithResponse(
            "core/user/email/update",
            {new_email: new_email, code: code},
        )
     }
}
