import { TCP_SERVICE } from "../script/service/net/TcpService";
import { CommandMessage, DataObject } from "./CommandMessage";

export abstract class BaseAPI {

    private channel_socket: string;
    
    constructor(channel_socket: string) {
        this.channel_socket = channel_socket;
    }

    protected changeChannelSocket(channel_socket: string) {
        this.channel_socket = channel_socket;
    }

    public getChannelSocket(): string {
        return this.channel_socket;
    }

    protected async sendRequest(channel_socket: string ,route: string, data?: DataObject | undefined, callback?: (data?: unknown) => unknown) {
        const context: CommandMessage = {
            route,
            data
        };
        const service = TCP_SERVICE.get(channel_socket);
        if (service) {
            await service.send(channel_socket,JSON.stringify(context));
        } else {
            console.error(`TcpService not found for socket: ${channel_socket}`);
        }
        if (callback){
            return callback();
        }
    }
    
    protected async send(channel_socket: string, route: string, data?: DataObject | undefined, callback?: (data: unknown) => unknown): Promise<void> {
        const context: CommandMessage = {
            route,
            data
        };
        const service = TCP_SERVICE.get(channel_socket);
        if (!service) {
            console.error(`TcpService not found for socket: ${channel_socket}`);
            return;
        }

        if (callback === undefined) { 
            await service.send(channel_socket, JSON.stringify(context));
        } else {
            await service.sendWithResponse(channel_socket,JSON.stringify(context),callback);
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