import { TCP_SERVICE } from "../../script/service/net/TcpService";

export interface MessageCommon {
    route: string;
    data: {
        // 简略信息，特殊消息可以为：[表情]，[图片]这种，文本可截取前20个字符
        scontent: string;
        // 通道id
        cid: string;
        // 用户id
        uid: string;
        // 发送时间
        send_time: string;
    }
}

export interface UIMessageCommon{
    route: string;
    data: string;
}

export async function praseChannelMessage(message: string) {
    const value = JSON.parse(message);
    //TCP_SERVICE.send()
}