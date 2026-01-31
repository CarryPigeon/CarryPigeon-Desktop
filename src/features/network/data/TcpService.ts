/**
 * @fileoverview TCP 服务（收发、拆包、握手协同）。
 * @description 平台边界模块：负责握手/解密，并将业务消息分发到前端消息处理链路；Netty 长度拆包由 Rust 侧完成。
 */
import { invokeTauri, listenTcpFrame, TAURI_COMMANDS, tauriLog } from "../../../shared/tauri";
import { Encryption } from "./Encryption";
import { messageReceiveService } from "../../chat/presentation/components/messages/messageReceiveService";
import type { FrameConfig } from "./Encryption";

/**
 * TCP service (data-layer / platform boundary).
 *
 * Responsibilities:
 * - Maintain per-server socket connection state
 * - Key exchange (handshake) coordination via `Encryption`
 * - Decrypt incoming frames (deframed by Rust) and dispatch messages
 * - Dispatch incoming business messages into the chat presentation layer
 *
 * Logging:
 * - Uses `tauriLog` so messages are persisted alongside Rust logs.
 */
class FuncMap{
    private map: Map<number, (data: unknown) => void>;
    private id_list: number[] = [];
    
    constructor(){
        this.map = new Map<number , (data: unknown) => void>();
    }
    /**
     * add method.
     * @param func - TODO.
     * @returns TODO.
     */
    public add(func: (data: unknown) => void): number {
        const id = this.id_allocate();
        this.map.set(id, func);
        return id;
    }

    /**
     * Register a callback that will be automatically removed after the first invocation.
     * This prevents leaking callbacks when using request/response patterns.
     * @param func - TODO.
     * @returns TODO.
     */
    public addOnce(func: (data: unknown) => void): number {
        let id = -1;
/**
 * wrapper 方法说明。
 * @param data - 参数说明。
 * @returns 返回值说明。
 */
        const wrapper = (data: unknown) => {
            try {
                func(data);
            } finally {
                if (id !== -1) this.remove(id);
            }
        };
        id = this.add(wrapper);
        return id;
    }
/**
 * remove 方法说明。
 * @param id - 参数说明。
 * @returns 返回值说明。
 */
    public remove(id: number){
        this.id_release(id);
        this.map.delete(id);
    }
/**
 * call 方法说明。
 * @param id - 参数说明。
 * @param data - 参数说明。
 * @returns 返回值说明。
 */
    public call(id: number, data: unknown){
        const func = this.map.get(id);
/**
 * if 方法说明。
 * @param func - 参数说明。
 * @returns 返回值说明。
 */
        if (func) {
            func(data);
        }
    }
    private readonly MAX_ID: number = 255; // 8位最大值
    
    /**
     * id_allocate method.
     * @returns TODO.
     */
    public id_allocate(): number {
        // 如果id_list已满（所有8位ID都在使用中），等待或重置
/**
 * if 方法说明。
 * @param this.id_list.length > - 参数说明。
 * @returns 返回值说明。
 */
        if (this.id_list.length >= this.MAX_ID + 1) {
            tauriLog.warn("All 8-bit callback IDs are in use; recycling the oldest ID.");
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

/**
 * id_release 方法说明。
 * @param id - 参数说明。
 * @returns 返回值说明。
 */
    public id_release(id: number){
        const index = this.id_list.indexOf(id);
/**
 * if 方法说明。
 * @param index ! - 参数说明。
 * @returns 返回值说明。
 */
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
    public readonly frameConfig: FrameConfig;

    constructor(socket: string, opts?: { frameConfig?: FrameConfig }) {
        this.funcMap = new FuncMap();
        this.frameConfig = opts?.frameConfig ?? { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
        this.encrypter = new Encryption(socket, { frameConfig: this.frameConfig });
        // 添加本频道到tcp_service中
        this.initPromise = invokeTauri(TAURI_COMMANDS.addTcpService, { serverSocket: socket, socket: socket });
    }

    /**
     * 等待 Rust 侧 TCP service 注册完成。
     * @returns Promise<void>
     */
    public async waitForInit() {
        await this.initPromise;
    }

    /**
     * 等待握手完成（收到 `/handshake`）。
     * @param timeoutMs - 超时时间（毫秒）
     * @returns Promise<void>
     */
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

    /**
     * 发送 JSON 文本（会按握手状态进行加密/封帧）。
     * @param server_socket - 目标服务端 socket
     * @param raw_data - 原始 JSON 文本
     * @param callback - 可选：Rust 侧返回文本回调
     * @returns Promise<void>
     */
    public async send(server_socket: string, raw_data: string, callback?:(data: string) => void): Promise<void> {
        try {
            const data = await this.encrypter.encrypt(raw_data);
            const res = await invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket: server_socket, data: Array.from(data) });
            if (callback) {
                callback(<string>res);
            }
        } catch (e) {
            tauriLog.error("Send failed", { error: String(e) });
            throw e;
        }
    }

    /**
     * 发送明文帧（不加密，仅 length-prefix 封帧）。
     * @param server_socket - 目标服务端 socket
     * @param raw_data - 明文 JSON 文本
     * @returns Promise<void>
     */
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
            invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket: server_socket, data: Array.from(frame) }).then(() => {
                resolve(null);
            }).catch((e) => {
                reject(e);
            });
        });
    }
    
    /**
     * 发送请求并等待响应（通过 8-bit id 关联回调）。
     * @param server_socket - 目标服务端 socket
     * @param raw_data - 原始 JSON 文本（会在内部注入 `id` 字段）
     * @param callback - 响应回调
     * @returns Promise<void>
     */
    public async sendWithResponse(server_socket: string, raw_data: string, callback: (data: unknown) => void): Promise<void> {
        const id = this.funcMap.addOnce(callback);
        let temp: Record<string, unknown>;
        try {
            temp = JSON.parse(raw_data) as Record<string, unknown>;
        } catch (e) {
            tauriLog.error("sendWithResponse payload is not valid JSON", { error: String(e) });
            this.funcMap.remove(id);
            throw e;
        }

        temp["id"] = id;
        const data = await this.encrypter.encrypt(JSON.stringify(temp));
        await invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket: server_socket, data: Array.from(data) });
    }

    /**
     * 处理一条解密后的 JSON 文本（来自拆包逻辑）。
     * @param data - 明文 JSON 文本
     * @returns Promise<void>
     * @param serverSocket - TODO.
     */
    public async listen(data: string, serverSocket: string) {
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
            tauriLog.error("JSON parse error", { error: String(e) });
            return;
        }
        
        // 记录接收到的所有消息，便于调试
        tauriLog.debug("Received message", { value });
        
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
                tauriLog.error("Handshake failed", { error: String(e) });
            }
        } 
        // 处理普通消息 / 通知
        else if (value["id"] !== undefined) {
            const id = Number(value["id"]);
            if (id === -1 && value["code"] === 0 && value["data"]) {
                messageReceiveService.showNewMessage(value, { serverSocket });
                return;
            }
            if (Number.isFinite(id)) {
                this.funcMap.call(id, value);
                return;
            }
        }

        // 处理其他消息
        messageReceiveService.showNewMessage(value, { serverSocket });
    }
}

listenTcpFrame(async (endata) => {
    const service = TCP_SERVICE.get(endata.payload.server_socket);
    if (!service) return;

    const framePayload = new Uint8Array(endata.payload.payload);
    if (framePayload.length === 0) return;

    let plaintext: string | null = null;
    try {
        plaintext = await service.encrypter.decrypt(framePayload);
    } catch (e) {
        if (service.encrypter.isHandshakeComplete()) {
            tauriLog.error("Encrypted frame decrypt failed after handshake", { error: String(e) });
            return;
        }
        try {
            plaintext = new TextDecoder("utf-8").decode(framePayload);
        } catch {
            tauriLog.error("Frame decode failed", { error: String(e) });
            return;
        }
    }

    if (!plaintext || plaintext.trim().length === 0) return;
    try {
        await service.listen(plaintext, endata.payload.server_socket);
    } catch (e) {
        tauriLog.error("Listen error", { error: String(e) });
    }
}).then(() => {});

/**
 * 创建并注册一个服务端 TCP service，并完成握手。
 * @param socket - 服务端 socket
 * @param opts - 连接选项（包含服务端 ECC 公钥）
 * @returns 已初始化并握手完成的 TcpService
 */
/**
 * crateServerTcpService 方法说明。
 * @param socket - 参数说明。
 * @param opts? - 参数说明。
 * @returns 返回值说明。
 */
export async function crateServerTcpService(socket: string) {
    // According to `docs/客户端开发指南.md`:
    // Netty frame: 2 bytes unsigned short length prefix (Big-Endian), followed by `length` bytes payload.
    const frameConfig: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
    const isMockSocket = socket.startsWith("mock://");

    const service = new TcpService(socket, { frameConfig });
    TCP_SERVICE.set(socket, service);
    await service.waitForInit();

    tauriLog.debug("Starting TCP service initialization", { socket, frameConfig });

    try {
        await service.encrypter.swapKey(0);
        tauriLog.debug("Handshake initiated", { socket, frameConfig });

        if (!isMockSocket) {
            await service.waitForKeyExchange(15000);
            tauriLog.debug("Handshake completed", { socket, frameConfig });
        } else {
            tauriLog.debug("Mock handshake bypassed", { socket, frameConfig });
        }

        return service;
    } catch (e) {
        tauriLog.error("TCP service initialization failed", { socket, frameConfig, error: String(e) });
        TCP_SERVICE.delete(socket);
        throw e;
    }
}

/**
 * @constant
 * @description 全局 TCP service registry（key 为 server socket）。
 */
export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();
