/**
 * @fileoverview TCP 服务（收发、拆包、握手协同）。
 * @description 平台边界模块：负责握手/解密，并将业务消息分发到前端消息处理链路；Netty 长度拆包由 Rust 侧完成。
 */
import { invokeTauri, listenTcpFrame, TAURI_COMMANDS, tauriLog, type TcpMessageEvent } from "@/shared/tauri";
import type { Event } from "@tauri-apps/api/event";
import { Encryption } from "./Encryption";
import { messageReceiveService } from "@/features/chat/presentation/components/messages/messageReceiveService";
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
class FuncMap {
  /**
   * Callback registry keyed by an 8-bit id.
   *
   * This is used to implement request/response style calls over TCP where the
   * native side returns a response that must be routed to the correct caller.
   */
  private map = new Map<number, (data: unknown) => void>();

  /**
   * List of currently allocated ids (used to avoid collisions).
   * We keep a list rather than a Set because we also need stable "oldest id"
   * recycling when the pool is exhausted.
   */
  private id_list: number[] = [];

  /**
   * Maximum id value for an 8-bit unsigned integer.
   */
  private readonly MAX_ID: number = 255;

  /**
   * Register a callback and return an id for later invocation.
   *
   * @param func - Callback function.
   * @returns Allocated callback id (0..255).
   */
  public add(func: (data: unknown) => void): number {
    const id = this.id_allocate();
    this.map.set(id, func);
    return id;
  }

  /**
   * Register a callback that will be automatically removed after first invocation.
   *
   * This prevents leaking callbacks when using request/response patterns.
   *
   * @param func - Callback function.
   * @returns Allocated callback id (0..255).
   */
  public addOnce(func: (data: unknown) => void): number {
    let id = -1;
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
   * Remove a callback by id and release that id back to the pool.
   *
   * @param id - Callback id.
   */
  public remove(id: number): void {
    this.id_release(id);
    this.map.delete(id);
  }

  /**
   * Invoke a callback by id if it exists.
   *
   * @param id - Callback id.
   * @param data - Payload to pass to the callback.
   */
  public call(id: number, data: unknown): void {
    const func = this.map.get(id);
    if (func) func(data);
  }

  /**
   * Allocate an unused 8-bit id.
   *
   * Allocation strategy:
   * - When the pool is exhausted, recycle the oldest id to avoid blocking the UI.
   * - Otherwise, pick a random unused id to minimize collisions.
   *
   * @returns Allocated id (0..255).
   */
  public id_allocate(): number {
    if (this.id_list.length >= this.MAX_ID + 1) {
      tauriLog.warn("All 8-bit callback IDs are in use; recycling the oldest ID.");
      return this.id_list.shift()!;
    }

    let candidateId: number;
    do {
      candidateId = Math.floor(Math.random() * (this.MAX_ID + 1));
    } while (this.id_list.includes(candidateId));

    this.id_list.push(candidateId);
    return candidateId;
  }

  /**
   * Release a previously allocated id.
   *
   * @param id - Callback id.
   */
  public id_release(id: number): void {
    const index = this.id_list.indexOf(id);
    if (index !== -1) this.id_list.splice(index, 1);
  }
}

export class TcpService {
    public encrypter: Encryption;
    private funcMap: FuncMap;
    private handshakeResolver: (() => void) | undefined;
    private handshakeRejecter: ((reason?: unknown) => void) | undefined;
    private initPromise: Promise<unknown>;
    public readonly frameConfig: FrameConfig;

    constructor(serverSocketKey: string, connectSocket: string, opts?: { frameConfig?: FrameConfig }) {
        this.funcMap = new FuncMap();
        this.frameConfig = opts?.frameConfig ?? { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
        this.encrypter = new Encryption(serverSocketKey, { transportSocket: connectSocket, frameConfig: this.frameConfig });
        // 添加本频道到tcp_service中
        this.initPromise = invokeTauri(TAURI_COMMANDS.addTcpService, { serverSocket: serverSocketKey, socket: connectSocket });
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
            }).catch((e: unknown) => {
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
     *
     * - 优先尝试识别握手响应（文本/JSON 两种形态），并在成功后 resolve 握手 Promise。
     * - 其他消息按 `id` 做请求-响应回调匹配；无法匹配时走通知/广播分发。
     *
     * @param data - 明文 JSON 文本（单帧 payload）。
     * @param serverSocket - 该帧所属的 server socket（用于后续 store 归因与事件分发）。
     * @returns Promise that resolves after the frame is handled.
     */
    public async listen(data: string, serverSocket: string): Promise<void> {
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

listenTcpFrame(async (endata: Event<TcpMessageEvent>) => {
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
 * Create and initialize a TcpService for a server socket.
 *
 * Behavior:
 * - Creates the service and stores it in the global `TCP_SERVICE` registry.
 * - Initializes handshake/key exchange (mock sockets bypass wait).
 * - Removes the service from the registry if initialization fails.
 *
 * @param socket - Server socket string.
 * @param connectSocket - Actual transport socket for the native connector (defaults to `socket`).
 * @returns Initialized `TcpService`.
 */
export async function crateServerTcpService(socket: string, connectSocket?: string) {
    const serverSocketKey = socket.trim();
    const transportSocket = String(connectSocket ?? serverSocketKey).trim() || serverSocketKey;
    // According to `docs/客户端开发指南.md`:
    // Netty frame: 2 bytes unsigned short length prefix (Big-Endian), followed by `length` bytes payload.
    const frameConfig: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
    const isMockSocket = transportSocket.startsWith("mock://");

    const service = new TcpService(serverSocketKey, transportSocket, { frameConfig });
    TCP_SERVICE.set(serverSocketKey, service);
    await service.waitForInit();

    tauriLog.debug("Starting TCP service initialization", { serverSocketKey, transportSocket, frameConfig });

    try {
        await service.encrypter.swapKey(0);
        tauriLog.debug("Handshake initiated", { serverSocketKey, transportSocket, frameConfig });

        if (!isMockSocket) {
            await service.waitForKeyExchange(15000);
            tauriLog.debug("Handshake completed", { serverSocketKey, transportSocket, frameConfig });
        } else {
            tauriLog.debug("Mock handshake bypassed", { serverSocketKey, transportSocket, frameConfig });
        }

        return service;
    } catch (e) {
        tauriLog.error("TCP service initialization failed", { serverSocketKey, transportSocket, frameConfig, error: String(e) });
        TCP_SERVICE.delete(serverSocketKey);
        throw e;
    }
}

/**
 * @constant
 * @description 全局 TCP service registry（key 为 server socket）。
 */
export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();
