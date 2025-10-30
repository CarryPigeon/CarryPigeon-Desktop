import { TCP_SERVICE } from "../script/service/net/TcpService";
import { CommandMessage, DataObject } from "./CommandMessage";

export abstract class BaseAPI {
    protected async sendRequest(route: string, data?: DataObject | undefined, callback?: (data?: unknown) => unknown) {
        const context: CommandMessage = {
            route,
            data
        };
        await TCP_SERVICE.send(JSON.stringify(context));
        if (callback){
            return callback();
        }
    }
    
    protected async sendRequestWithResponse(route: string, data?: DataObject | undefined, callback?: (data: unknown) => unknown): Promise<unknown> {
        const context: CommandMessage = {
            route,
            data
        };
        await TCP_SERVICE.send(JSON.stringify(context));
        
        return await TCP_SERVICE.receive((responseData) => {
            if (callback) {
                return callback(responseData);
            }
            try{
                return parseInt(responseData);
            } catch(err){ return null;}
        });
    }

    protected async receive() {
        return await TCP_SERVICE.receive(()=>{});
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