import { TCP_SERVICE } from "../script/service/net/TcpService";
import { CommandMessage, DataObject } from "./CommandMessage";

export abstract class BaseAPI {

    private channel_id: number;
    
    constructor(channel_id: number) {
        this.channel_id = channel_id;
    }

    protected changeChannelId(channel_id: number) {
        this.channel_id = channel_id;
    }

    public getChannelId(): number {
        return this.channel_id;
    }

    protected async sendRequest(channel_id: number ,route: string, data?: DataObject | undefined, callback?: (data?: unknown) => unknown) {
        const context: CommandMessage = {
            route,
            data
        };
        await TCP_SERVICE.send(channel_id,JSON.stringify(context));
        if (callback){
            return callback();
        }
    }
    
    protected async sendRequestWithResponse(channel_id: number, route: string, callback: (data: string) => void, data?: DataObject | undefined): Promise<void> {
        const context: CommandMessage = {
            route,
            data
        };
        await TCP_SERVICE.sendWithResponse(channel_id,JSON.stringify(context),callback);
    }
    
    protected handleError(code: number): void {
        switch (code) {
            case 100:
                // TODO: 弹窗提示失败
                console.error("操作失败");
                break;
            case 200:
                // 成功，无需处理
                break;
            case 300:
                // TODO: 弹窗提示权限校验失败
                console.error("权限不足");
                break;
            default:
                console.error(`未知错误代码: ${code}`);
        }
    }
}