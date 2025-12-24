import { listen } from "@tauri-apps/api/event";
//import { Config } from "../../config/Config.ts";
import { Encryption } from "../Encryption/Encryption.ts";
import { invoke } from "@tauri-apps/api/core";
import { messageReceiveService } from "../../../components/messages/messageReceiveService";

class FuncMap{
    private map: Map<number, (data:string) => void>;
    private id_list: number[] = [];
    
    constructor(){
        this.map = new Map<number , (data:string) => void>();
    }
    public add(func: (data:string) => void): number {
        const id = this.id_allocate();
        this.map.set(id, func);
        return id;
    }
    public remove(id: number){
        this.id_release(id);
        this.map.delete(id);
    }
    public call(id: number, data: string){
        const func = this.map.get(id);
        if (func) {
            func(data);
        }
    }
    private readonly MAX_ID: number = 255; // 8位最大值
    
    public id_allocate(): number {
        // 如果id_list已满（所有8位ID都在使用中），等待或重置
        if (this.id_list.length >= this.MAX_ID + 1) {
            console.warn("所有8位ID已分配完毕，将回收最早的ID");
            // 移除最早添加的ID并返回它
            return this.id_list.shift()!;
        }
        
        // 生成随机候选ID
        let candidateId: number;
        
        // 循环直到找到一个未使用的ID
        do {
            candidateId = Math.floor(Math.random() * (this.MAX_ID + 1));
        } while (this.id_list.includes(candidateId));
        
        // 将新分配的ID添加到活跃列表
        this.id_list.push(candidateId);
        
        return candidateId;
    }

    public id_release(id: number){
        const index = this.id_list.indexOf(id);
        if (index !== -1) {
            this.id_list.splice(index, 1);
        }
    }
}

export class TcpService {
    public encrypter: Encryption;
    private funcMap: FuncMap;
    private handshakeResolver: (() => void) | undefined;
    private handshakeRejecter: ((reason?: any) => void) | undefined;

    constructor(socket: string) {
        this.funcMap = new FuncMap();
        this.encrypter = new Encryption(socket);
        // 添加本频道到tcp_service中
        invoke("add_tcp_service", { channelSocket: socket, socket: socket });
    }

    public waitForKeyExchange(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.handshakeResolver = resolve;
            this.handshakeRejecter = reject;
            setTimeout(() => {
                if (this.handshakeRejecter) {
                    this.handshakeRejecter(new Error("Key exchange timeout"));
                    this.cleanupHandshake();
                }
            }, 5000);
        });
    }

    private cleanupHandshake() {
        this.handshakeResolver = undefined;
        this.handshakeRejecter = undefined;
    }

    public async send(channel_socket: string, raw_data: string, callback?:(data: string) => void){
        return new Promise((resolve, reject) =>{
            const data = this.encrypter.encrypt(raw_data);
            invoke("send_tcp_service", { channelSocket: channel_socket, data }).then((res) => {
                if (callback) {
                    callback(<string>res);
                }
                resolve(null);
            }).catch((e) => {
                reject(e);
            });
        });
    }

    public async sendRaw(channel_socket: string, raw_data: string){
        return new Promise((resolve, reject) =>{
            invoke("send_tcp_service", { channelSocket: channel_socket, data: raw_data }).then(() => {
                resolve(null);
            }).catch((e) => {
                reject(e);
            });
        });
    }
    
    public async sendWithResponse(channel_socket: string, raw_data: string, callback: (data: string) => void){
        const id = this.funcMap.add(callback);
        const temp = JSON.parse(raw_data);
        temp["id"] = id;
        return new Promise(() => {
            const data = this.encrypter.encrypt(JSON.stringify(temp));
            invoke("send_tcp_service", { channelSocket: channel_socket, data });
        });
    }

    public async listen(data:string) {
        const value = JSON.parse(data);
        // TODO: 处理捕获信息
        if (value["id"] != -1) {
            this.funcMap.call(value["id"], value);
        } else if (value["key"]) {
            try {
                await this.encrypter.decryptAESKey(value["key"]);
                if (this.handshakeResolver) {
                    this.handshakeResolver();
                    this.cleanupHandshake();
                }
            } catch (e) {
                if (this.handshakeRejecter) {
                    this.handshakeRejecter(e);
                    this.cleanupHandshake();
                }
            }
        } else {
            messageReceiveService.showNewMessage(value);
        } 
    }
}

listen<string>('tcp-message',(endata) => {
    TCP_SERVICE.forEach((service) => {
        let data = endata.payload;
        try {
            data = service.encrypter.decrypt(endata.payload);
        } catch {
            // 忽略解密错误，可能是密钥交换消息
        }
        service.listen(data).then(r => {
            invoke("log_warning",{r});
        });
    });
}).then(r => {
    invoke("log_warning", {r});
})

export async function crateServerTcpService(socket: string) {
    const service = new TcpService(socket);
    TCP_SERVICE.set(socket, service);
    const handshake = service.waitForKeyExchange();
    await service.encrypter.swapKey(0);
    return handshake;
}

export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();
