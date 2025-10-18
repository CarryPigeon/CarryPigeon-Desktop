export interface MessageCommon {
    router: string;
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

export async function paseChannelMessage(message: MessageCommon) {
    switch (message.router) {
        case "channel":
            break;
        default:
            break;
    }
}