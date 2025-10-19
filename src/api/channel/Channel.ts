import { TCP_SERVICE } from "../../script/service/net/TcpService";
import { CommandMessage } from "../CommandMessage";

export async function createChannel(){
    // 真心觉得这种参数不是一个好的API设计
    let context: CommandMessage = {
        route: "core/channel/create",
        data: undefined
    };
    TCP_SERVICE.send(JSON.stringify(context));
    return TCP_SERVICE.receive((data) => {
        const value = JSON.parse(data);
        if (value["channel"] != null) {
            return value["channel"];
        } else {
            //TODO: 弹窗提示创建失败
        }
    });
}