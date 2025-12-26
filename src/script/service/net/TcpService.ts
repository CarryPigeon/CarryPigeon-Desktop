import { listen } from "@tauri-apps/api/event";
//import { Config } from "../../config/Config.ts";
import { Encryption } from "../Encryption/Encryption.ts";
import { invoke } from "@tauri-apps/api/core";
import { messageReceiveService } from "../../../components/messages/messageReceiveService";
import type { FrameConfig } from "../Encryption/Encryption";

class FuncMap{
    private map: Map<number, (data: unknown) => void>;
    private id_list: number[] = [];
    
    constructor(){
        this.map = new Map<number , (data: unknown) => void>();
    }
    public add(func: (data: unknown) => void): number {
        const id = this.id_allocate();
        this.map.set(id, func);
        return id;
    }
    public remove(id: number){
        this.id_release(id);
        this.map.delete(id);
    }
    public call(id: number, data: unknown){
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
    public readonly frameConfig: FrameConfig;

    constructor(socket: string, opts?: { serverEccPublicKeyBase64?: string; frameConfig?: FrameConfig }) {
        this.funcMap = new FuncMap();
        this.frameConfig = opts?.frameConfig ?? { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
        this.encrypter = new Encryption(socket, {
            serverEccPublicKeyBase64: opts?.serverEccPublicKeyBase64,
            frameConfig: this.frameConfig,
        });
        // 添加本频道到tcp_service中
        this.initPromise = invoke("add_tcp_service", { serverSocket: socket, socket: socket });
    }

    public async waitForInit() {
        await this.initPromise;
    }

    public waitForKeyExchange(timeoutMs: number = 15000): Promise<void> {
        return new Promise((resolve, reject) => {
            this.handshakeResolver = resolve;
            this.handshakeRejecter = reject;
            setTimeout(() => {
                if (this.handshakeRejecter) {
                    this.handshakeRejecter(new Error("Key exchange timeout"));
                    this.cleanupHandshake();
                }
            }, timeoutMs);
        });
    }

    private cleanupHandshake() {
        this.handshakeResolver = undefined;
        this.handshakeRejecter = undefined;
    }

    public async send(server_socket: string, raw_data: string, callback?:(data: string) => void): Promise<void> {
        try {
            const data = await this.encrypter.encrypt(raw_data);
            const res = await invoke("send_tcp_service", { serverSocket: server_socket, data: Array.from(data) });
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
            const bytes = new TextEncoder().encode(raw_data);
            const header = this.frameConfig.lengthBytes;
            const totalLength = bytes.length + (this.frameConfig.lengthIncludesHeader ? header : 0);
            const frame = new Uint8Array(header + bytes.length);
            const view = new DataView(frame.buffer);
            if (header === 2) {
                view.setUint16(0, totalLength, this.frameConfig.byteOrder === "le");
            } else {
                view.setUint32(0, totalLength >>> 0, this.frameConfig.byteOrder === "le");
            }
            frame.set(bytes, header);
            invoke("send_tcp_service", { serverSocket: server_socket, data: Array.from(frame) }).then(() => {
                resolve(null);
            }).catch((e) => {
                reject(e);
            });
        });
    }
    
    public async sendWithResponse(server_socket: string, raw_data: string, callback: (data: unknown) => void): Promise<void> {
        const id = this.funcMap.add(callback);
        const temp = JSON.parse(raw_data);
        temp["id"] = id;
        const data = await this.encrypter.encrypt(JSON.stringify(temp));
        await invoke("send_tcp_service", { serverSocket: server_socket, data: Array.from(data) });
    }

    public async listen(data:string) {
        // 先用文本解析握手通知（避免 session_id 超过 JS 安全整数导致精度丢失）
        if (this.encrypter.tryHandleHandshakeResponseText(data)) {
            if (this.handshakeResolver) {
                this.handshakeResolver();
                this.cleanupHandshake();
            }
            return;
        }

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
        
        // 处理握手成功通知（/handshake）
        if (this.encrypter.tryHandleHandshakeResponse(value)) {
            try {
                if (this.handshakeResolver) {
                    this.handshakeResolver();
                    this.cleanupHandshake();
                }
            } catch (e) {
                if (this.handshakeRejecter) {
                    this.handshakeRejecter(e);
                    this.cleanupHandshake();
                }
                invoke("log_error", {error: `Handshake failed: ${e}`});
            }
        } 
        // 处理普通消息
        else if (value["id"] !== undefined) {
            const id = Number(value["id"]);
            if (Number.isFinite(id)) {
                this.funcMap.call(id, value);
            }
        } 
        // 处理其他消息
        else {
            messageReceiveService.showNewMessage(value);
        } 
    }
}

type TcpMessageEvent = { server_socket: string; payload: number[] };

listen<TcpMessageEvent>("tcp-message", async (endata) => {
    const service = TCP_SERVICE.get(endata.payload.server_socket);
    if (!service) return;

    const uint8arr = new Uint8Array(endata.payload.payload);
    if (uint8arr.length === 0) return;

    // 将新数据追加到缓冲区
    const newBuffer = new Uint8Array(service.buffer.length + uint8arr.length);
    newBuffer.set(service.buffer);
    newBuffer.set(uint8arr, service.buffer.length);
    service.buffer = newBuffer;

    // 按 Netty 2B 长度前缀帧格式拆包
    while (service.buffer.length > 0) {
        let processed = false;

        const headerBytes = service.frameConfig.lengthBytes;
        if (service.buffer.length >= headerBytes) {
            const view = new DataView(service.buffer.buffer, service.buffer.byteOffset, service.buffer.byteLength);
            const rawLength =
                headerBytes === 2
                    ? view.getUint16(0, service.frameConfig.byteOrder === "le")
                    : view.getUint32(0, service.frameConfig.byteOrder === "le");
            const payloadLength = service.frameConfig.lengthIncludesHeader ? rawLength - headerBytes : rawLength;
            if (payloadLength < 0 || payloadLength > 10_000_000) {
                invoke("log_error", { error: `Invalid frame length: raw=${rawLength}, header=${headerBytes}` });
                break;
            }

            if (service.buffer.length >= headerBytes + payloadLength) {
                const framePayload = service.buffer.slice(headerBytes, headerBytes + payloadLength);
                service.buffer = service.buffer.slice(headerBytes + payloadLength);
                processed = true;

                let plaintext: string | null = null;
                try {
                    plaintext = await service.encrypter.decrypt(framePayload);
                } catch (e) {
                    if (service.encrypter.isHandshakeComplete()) {
                        invoke("log_error", { error: `Encrypted frame decrypt failed after handshake: ${e}` });
                        continue;
                    }
                    try {
                        plaintext = new TextDecoder("utf-8").decode(framePayload);
                    } catch {
                        invoke("log_error", { error: `Frame decode failed: ${e}` });
                        continue;
                    }
                }

                if (!plaintext || plaintext.trim().length === 0) continue;
                try {
                    await service.listen(plaintext);
                } catch (e) {
                    invoke("log_error", { error: `Listen error: ${e}` });
                }
                continue;
            }
        }

        if (!processed) break;
    }

    // 如果缓冲区过大（例如超过1MB），强制清空以防内存泄漏
    if (service.buffer.length > 1024 * 1024) {
        invoke("log_error", {error: "Buffer overflow, clearing buffer"});
        service.buffer = new Uint8Array(0);
    }
}).then(() => {});

export async function crateServerTcpService(socket: string, opts?: { serverEccPublicKeyBase64?: string }) {
    // According to client-developer-guide.md:
    // Netty frame: 2 bytes unsigned short length prefix (Big-Endian), followed by `length` bytes payload.
    const frameConfig: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };

    const service = new TcpService(socket, { serverEccPublicKeyBase64: opts?.serverEccPublicKeyBase64, frameConfig });
    TCP_SERVICE.set(socket, service);
    await service.waitForInit();

    invoke("log_debug", {msg: `Starting TCP service initialization for socket: ${socket} (frame=${JSON.stringify(frameConfig)})`});

    try {
        await service.encrypter.swapKey(0);
        invoke("log_debug", {msg: `Handshake initiated for socket: ${socket} (frame=${JSON.stringify(frameConfig)})`});

        await service.waitForKeyExchange(15000);
        invoke("log_debug", {msg: `Handshake completed successfully for socket: ${socket} (frame=${JSON.stringify(frameConfig)})`});

        return service;
    } catch (e) {
        invoke("log_error", {error: `TCP service initialization failed for socket ${socket} (frame=${JSON.stringify(frameConfig)}): ${e}`});
        TCP_SERVICE.delete(socket);
        throw e;
    }
}

export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();
