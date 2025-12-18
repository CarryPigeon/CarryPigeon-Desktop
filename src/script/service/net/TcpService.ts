import { listen } from "@tauri-apps/api/event";
import { Config } from "../../config/Config.ts";
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

    constructor(socket: string) {
        this.funcMap = new FuncMap();
        this.encrypter = new Encryption(socket);
        // 添加本频道到tcp_service中
        invoke("add_tcp_service", { socket });
    }

    public async send(channel_socket: string, raw_data: string, callback?:(data: string) => void){
        return new Promise((resolve, reject) =>{
            const data = this.encrypter.encrypt(raw_data);
            invoke("send_tcp_service", { channel_id: channel_socket, data }).then((res) => {
                if (callback) {
                    callback(<string>res);
                }
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
            invoke("send_tcp_service", { channel_id: channel_socket, data });
        });
    }

    public async listen(data:string) {
        const value = JSON.parse(data);
        // TODO: 处理捕获信息
        if (value["id"] != -1) {
            this.funcMap.call(value["id"], value);
        } else if (value["key"]) {
            await this.encrypter.decryptAESKey(value["key"]);
        } else {
            messageReceiveService.showNewMessage(value);
        } 
    }
}

listen<string>('tcp-message',(endata) => {
    TCP_SERVICE.listen(TCP_SERVICE.encrypter.decrypt(endata.payload)).then(r => {
        invoke("log-warning",{r});
    });
}).then(r => {
    invoke("log-warning", {r});
})

export const TCP_SERVICE: TcpService = new TcpService(<string>Config["socket"]);
