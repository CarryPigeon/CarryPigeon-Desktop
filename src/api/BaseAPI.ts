import { TCP_SERVICE } from "../script/service/net/TcpService";
import { CommandMessage } from "./CommandMessage";

export abstract class BaseAPI {
    protected sendRequest(route: string, data?: any, callback?: (data?: any) => any) {
        const context: CommandMessage = {
            route,
            data
        };
        TCP_SERVICE.send(JSON.stringify(context));
        if (callback){
            return callback();
        }
    }
    
    protected sendRequestWithResponse(route: string, data?: any, callback?: (data: any) => any): any {
        const context: CommandMessage = {
            route,
            data
        };
        TCP_SERVICE.send(JSON.stringify(context));
        
        const response = TCP_SERVICE.receive((responseData) => {
            if (callback) {
                return callback(responseData);
            }
            return responseData;
        });
        
        if (typeof response === "number") {
            this.handleError(response);
        }
        
        return response;
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