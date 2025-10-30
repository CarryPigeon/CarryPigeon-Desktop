import Avatar from '/test_avatar.jpg?url';
class UserData {
    private readonly username: string;
    private readonly email: string;
    private readonly id: number;
    private readonly avatar: string;

    constructor() {
        //TODO: 获取信息
        this.username = "";
        this.email = "";
        this.id = 0;
        this.avatar = Avatar;
    }

    public getUsername(){
        return this.username;
    }
    public getEmail(){
        return this.email;
    }
    public getId(){
        return this.id;
    }
    public getAvatar(){
        return this.avatar;
    }
}

let userData = new UserData();

export {userData};