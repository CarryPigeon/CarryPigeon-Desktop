import { TCP_SERVICE } from "../script/service/net/TcpService";
import { CommandMessage, DataObject } from "./CommandMessage";

export abstract class BaseAPI {

    private server_socket: string;
    
    constructor(server_socket: string) {
        this.server_socket = server_socket;
    }

    protected changeChannelSocket(server_socket: string) {
        this.server_socket = server_socket;
    }

    public getChannelSocket(): string {
        return this.server_socket;
    }

    protected async sendRequest(server_socket: string ,route: string, data?: DataObject | undefined, callback?: (data?: unknown) => unknown) {
        const context: CommandMessage = {
            route,
            data
        };
        const service = TCP_SERVICE.get(server_socket);
        if (service) {
            await service.send(server_socket,JSON.stringify(context));
        } else {
            console.error(`TcpService not found for socket: ${server_socket}`);
        }
        if (callback){
            return callback();
        }
    }
    
    protected async send(server_socket: string, route: string, data?: DataObject | undefined, callback?: (data: unknown) => unknown): Promise<void> {
        const context: CommandMessage = {
            route,
            data
        };
        const service = TCP_SERVICE.get(server_socket);
        if (!service) {
            console.error(`TcpService not found for socket: ${server_socket}`);
            return;
        }

        if (callback === undefined) { 
            await service.send(server_socket, JSON.stringify(context));
        } else {
            await service.sendWithResponse(server_socket,JSON.stringify(context),callback);
        }
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