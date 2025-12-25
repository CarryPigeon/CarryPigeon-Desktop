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
    private handshakeRejecter: ((reason?: unknown) => void) | undefined;
    private initPromise: Promise<unknown>;
    public buffer: Uint8Array = new Uint8Array(0); // 使用Uint8Array作为缓冲区

    constructor(socket: string) {
        this.funcMap = new FuncMap();
        this.encrypter = new Encryption(socket);
        // 添加本频道到tcp_service中
        this.initPromise = invoke("add_tcp_service", { serverSocket: socket, socket: socket });
    }

    public async waitForInit() {
        await this.initPromise;
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
            }, 15000); // 增加超时时间到15秒，确保能等待服务端响应
        });
    }

    private cleanupHandshake() {
        this.handshakeResolver = undefined;
        this.handshakeRejecter = undefined;
    }

    public async send(server_socket: string, raw_data: string, callback?:(data: string) => void): Promise<void> {
        try {
            const data = await this.encrypter.encrypt(raw_data);
            const res = await invoke("send_tcp_service", { serverSocket: server_socket, data });
            if (callback) {
                callback(<string>res);
            }
        } catch (e) {
            invoke("log_error", {error: `Send failed: ${e}`});
            throw e;
        }
    }

    public async sendRaw(server_socket: string, raw_data: string){
        return new Promise((resolve, reject) =>{
            invoke("send_tcp_service", { serverSocket: server_socket, data: raw_data }).then(() => {
                resolve(null);
            }).catch((e) => {
                reject(e);
            });
        });
    }
    
    public async sendWithResponse(server_socket: string, raw_data: string, callback: (data: string) => void): Promise<void> {
        const id = this.funcMap.add(callback);
        const temp = JSON.parse(raw_data);
        temp["id"] = id;
        const data = await this.encrypter.encrypt(JSON.stringify(temp));
        await invoke("send_tcp_service", { serverSocket: server_socket, data });
    }

    public async listen(data:string) {
        let value;
        try {
            value = JSON.parse(data);
        } catch (e) {
            // 忽略JSON解析错误，可能是不完整的消息或其他格式
            invoke("log_error", {error: `JSON parse error: ${e}, data: ${data}`});
            return;
        }
        
        // 记录接收到的所有消息，便于调试
        invoke("log_debug", {msg: `Received message: ${JSON.stringify(value)}`});
        
        // 处理密钥交换响应 - 支持多种格式
        if (value["key"] || value["type"] === "key_exchange" || value["action"] === "key_exchange_response") {
            try {
                // 直接使用value对象，因为decryptAESKey方法内部会处理JSON解析
                await this.encrypter.decryptAESKey(JSON.stringify(value));
                if (this.handshakeResolver) {
                    this.handshakeResolver();
                    this.cleanupHandshake();
                }
            } catch (e) {
                if (this.handshakeRejecter) {
                    this.handshakeRejecter(e);
                    this.cleanupHandshake();
                }
                invoke("log_error", {error: `Key exchange failed: ${e}`});
            }
        } 
        // 处理普通消息
        else if (value["id"] !== undefined) {
            this.funcMap.call(value["id"], value);
        } 
        // 处理其他消息
        else {
            messageReceiveService.showNewMessage(value);
        } 
    }
}

listen<number[]>('tcp-message', async (endata) => {
    TCP_SERVICE.forEach(async (service) => {
        const uint8arr = new Uint8Array(endata.payload);
        
        // 首先检查是否为密钥交换阶段（AESKey尚未设置）
        // 如果是密钥交换阶段，需要特殊处理
        
        // 记录原始数据的Hex，用于调试
        // const hex = Array.from(uint8arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
        // invoke("log_debug", {msg: `Received raw data (hex): ${hex}`});

        // 记录原始数据的Hex，用于调试
        const hexLog = Array.from(uint8arr).map(b => b.toString(16).padStart(2, '0')).join(' ');
        invoke("log_debug", {msg: `Received raw data (hex): ${hexLog}`});

        // 将新数据追加到缓冲区
        const newBuffer = new Uint8Array(service.buffer.length + uint8arr.length);
        newBuffer.set(service.buffer);
        newBuffer.set(uint8arr, service.buffer.length);
        service.buffer = newBuffer;

        // 处理缓冲区中的数据
        while (service.buffer.length > 0) {
            let processed = false;

            // 1. 尝试解析二进制长度前缀包 (Length: u16, Body: bytes)
            // 假设最小包长度为 2 (Length) + 32 (Body) = 34 bytes (根据日志观察)
            if (service.buffer.length >= 34) {
                const view = new DataView(service.buffer.buffer, service.buffer.byteOffset, service.buffer.byteLength);
                const length = view.getUint16(0, false); // Big Endian

                // 检查是否匹配观察到的特定二进制格式: Length=32 (0x0020)
                if (length === 32 && service.buffer.length >= length + 2) {
                    const packet = service.buffer.slice(2, 2 + length);
                    
                    // 尝试解析二进制结构: [ID: u64] [Padding: u64] [Key: u128]
                    // ID (8 bytes)
                    // Padding (8 bytes)
                    // Key (16 bytes)
                    
                    // 提取Key (最后16字节)
                    const keyBytes = packet.slice(16, 32);
                    // 转换为Base64
                    let binary = '';
                    for (let i = 0; i < keyBytes.length; i++) {
                        binary += String.fromCharCode(keyBytes[i]);
                    }
                    const keyBase64 = btoa(binary);
                    
                    // 构造JSON对象
                    const json = JSON.stringify({
                        id: 0, // 假设ID为0，或者从前8字节解析
                        key: keyBase64,
                        session_id: "binary_session"
                    });
                    
                    invoke("log_debug", {msg: `Parsed binary packet, key: ${keyBase64}`});
                    
                    try {
                        await service.listen(json);
                    } catch (e) {
                        invoke("log_error", {error: `Listen error (binary): ${e}`});
                    }
                    
                    // 移除已处理的数据
                    service.buffer = service.buffer.slice(2 + length);
                    processed = true;
                    continue;
                }
            }

            // 2. 尝试解析换行符分隔的文本消息
            const newlineIndex = service.buffer.indexOf(10); // 10 is '\n'
            if (newlineIndex !== -1) {
                const lineBytes = service.buffer.slice(0, newlineIndex);
                const decoder = new TextDecoder('utf-8');
                const line = decoder.decode(lineBytes).trim();
                
                // 移除已处理的数据 (包括换行符)
                service.buffer = service.buffer.slice(newlineIndex + 1);
                processed = true;
                
                if (line.length === 0) continue;

                // 尝试清理消息中的非JSON字符
                let cleanMsg = line;
                const jsonStart = line.indexOf('{');
                const jsonEnd = line.lastIndexOf('}');
                if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                        cleanMsg = line.substring(jsonStart, jsonEnd + 1);
                }

                let decryptedData = cleanMsg;
                try {
                    // 使用异步解密
                    decryptedData = await service.encrypter.decrypt(cleanMsg);
                } catch {
                    // 忽略解密错误，可能是密钥交换消息或尚未加密的数据
                    invoke("log_debug", {msg: `Decryption failed, treating as plain text: ${cleanMsg}`});
                }
                
                // 确保只有有效的JSON才会被处理
                try {
                    await service.listen(decryptedData);
                } catch (e) {
                    invoke("log_error", {error: `Listen error: ${e}`});
                }
                continue;
            }

            // 如果没有处理任何数据，跳出循环等待更多数据
            if (!processed) {
                break;
            }
        }
        
        // 如果缓冲区过大（例如超过1MB），强制清空以防内存泄漏
        if (service.buffer.length > 1024 * 1024) {
             invoke("log_error", {error: "Buffer overflow, clearing buffer"});
             service.buffer = new Uint8Array(0);
        }
    });
}).then(() => {
    // 移除不必要的日志
})

export async function crateServerTcpService(socket: string) {
    const service = new TcpService(socket);
    TCP_SERVICE.set(socket, service);
    await service.waitForInit();
    
    invoke("log_debug", {msg: `Starting TCP service initialization for socket: ${socket}`});
    
    try {
        // 先启动密钥交换
        await service.encrypter.swapKey(0);
        invoke("log_debug", {msg: `Key exchange initiated for socket: ${socket}`});
        
        // 然后等待密钥交换完成，使用waitForKeyExchange方法中的超时机制（15秒）
        await service.waitForKeyExchange();
        invoke("log_debug", {msg: `Key exchange completed successfully for socket: ${socket}`});
        
        return service;
    } catch (e) {
        invoke("log_error", {error: `TCP service initialization failed for socket ${socket}: ${e}`});
        // 清理资源
        TCP_SERVICE.delete(socket);
        throw e;
    }
}

export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();
