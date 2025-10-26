import * as net from "node:net";
import {pushTask} from "./praseJsonBody.ts";
import { Config} from "../../config/Config.ts";
import { Encryption } from "../Encryption/Encryption.ts";

export class TcpService {
    public client: net.Socket
    public encrypter: Encryption

    constructor(socket: string) {
        this.encrypter = new Encryption(socket);
        this.client = net.connect(socket);
    }

    public createConnection(socket: string)  {
        const client = new net.Socket();
        return client.connect(socket,() =>{
            client.on("data",(data:string) => {
                pushTask(data)
            })
            client.on("close", () => { client.end(); });
        });
    }

    public async send(data: string): Promise<any> {
    return new Promise((resolve, reject) => {
        try {
            let en_data = this.encrypter?.encrypt(data); // 修正为encrypt
            const success = this.client.write(en_data, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(success);
                }
            });
            // 如果写入缓冲区已满，write返回false
            if (!success) {
                // 监听drain事件，表示缓冲区已清空可以继续写入
                this.client.once('drain', () => resolve(true));
            }
        } catch (error) {
            reject(error);
        }
        this.receiveOnce().then((data) => {
            resolve(data);
        }).catch((err) => {
            reject(err);
        });
    });
}

    /**
     * 监听单个数据响应
     * @returns Promise<string> 包含解密后数据的Promise
     */
    public async receiveOnce(): Promise<string> {
        return new Promise((resolve) => {
            const handler = (data: Buffer) => {
                const decryptedData = this.encrypter.decrypt(data.toString());
                this.client.off("data", handler); // 只接收一次数据后移除监听器
                resolve(decryptedData);
            };
            this.client.on("data", handler);
        });
    }
    
    /**
     * 持续监听数据
     * @param callback 每次接收到数据时调用的回调函数
     * @returns 取消监听的函数
     */
    public async receive(callback: (data: string) => any): Promise<() => void> {
        const handler = (data: Buffer) => {
            callback(this.encrypter.decrypt(data.toString()));
        };
        this.client.on("data", handler);
        
        // 返回取消监听的函数
        return () => {
            this.client.off("data", handler);
        };
    }

}

export var TCP_SERVICE: TcpService = new TcpService(Config["socket"]);
