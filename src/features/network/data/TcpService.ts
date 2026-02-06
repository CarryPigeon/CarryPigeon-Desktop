/**
 * @fileoverview TCP 服务（收发、拆包、握手协同）。
 * @description 平台边界模块：负责握手/解密，并将业务消息分发到前端消息处理链路；Netty 长度拆包由 Rust 侧完成。
 */
import { invokeTauri, listenTcpFrame, TAURI_COMMANDS, tauriLog, type TcpMessageEvent } from "@/shared/tauri";
import type { Event } from "@tauri-apps/api/event";
import { Encryption } from "./Encryption";
import { frameNettyPayload, type FrameConfig } from "./frameCodec";
import { publishIncomingMessage } from "@/shared/net/incomingMessageSink";
import { setTcpServiceProvider } from "@/shared/net/tcp/tcpServiceProvider";

/**
 * TCP 服务（数据层 / 平台边界）。
 *
 * 职责：
 * - 维护“按服务端 socket”维度的连接状态；
 * - 通过 `Encryption` 协同完成换钥/握手；
 * - 对 Rust 侧已拆包的帧做解密，并分发到前端消息链路；
 * - 将业务消息派发到上层注册的入站消息 sink（避免 data → presentation 反向依赖）。
 *
 * 日志：
 * - 统一使用 `tauriLog`，便于与 Rust 日志一起持久化与检索。
 */
class FuncMap {
  /**
   * 回调注册表（以 8-bit id 为 key）。
   *
   * 用途：
   * 在 TCP 上实现 request/response 风格调用：原生侧回包携带 id，
   * 前端据此路由到正确的回调。
   */
  private map = new Map<number, (data: unknown) => void>();

  /**
   * 当前已分配 id 列表（用于避免冲突）。
   *
   * 说明：
   * 使用数组而非 Set，是因为在池耗尽时需要稳定地回收“最早分配”的 id。
   */
  private id_list: number[] = [];

  /**
   * 8-bit 无符号整数的最大 id 值。
   */
  private readonly MAX_ID: number = 255;

  /**
   * 注册回调并返回 id，用于后续回包时调用。
   *
   * @param func - 回调函数。
   * @returns 分配到的回调 id（0..255）。
   */
  public add(func: (data: unknown) => void): number {
    const id = this.id_allocate();
    this.map.set(id, func);
    return id;
  }

  /**
   * 注册一次性回调：首次触发后自动移除。
   *
   * 用于避免 request/response 场景下回调泄漏。
   *
   * @param func - 回调函数。
   * @returns 分配到的回调 id（0..255）。
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
   * 按 id 移除回调，并释放该 id 回到池中。
   *
   * @param id - 回调 id。
   */
  public remove(id: number): void {
    this.id_release(id);
    this.map.delete(id);
  }

  /**
   * 按 id 调用回调（若存在）。
   *
   * @param id - 回调 id。
   * @param data - 传递给回调的载荷。
   */
  public call(id: number, data: unknown): void {
    const func = this.map.get(id);
    if (func) func(data);
  }

  /**
   * 分配一个未使用的 8-bit id。
   *
   * 分配策略：
   * - 池耗尽时，回收最早分配的 id，避免阻塞 UI；
   * - 否则随机挑选未使用 id，降低冲突概率。
   *
   * @returns 分配到的 id（0..255）。
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
   * 释放一个已分配的 id。
   *
   * @param id - 回调 id。
   */
  public id_release(id: number): void {
    const index = this.id_list.indexOf(id);
    if (index !== -1) this.id_list.splice(index, 1);
  }
}

/**
 * TCP 服务（数据层 / 平台边界）。
 *
 * 职责：
 * - 通过 Tauri 命令驱动 Rust 侧建立连接（按 server_socket 维度注册）；
 * - 与 `Encryption` 协同完成换钥与握手；
 * - 解密来自 Rust 侧的单帧 payload，并分发到消息处理链路；
 * - 提供 request/response 风格回调映射（8-bit id）。
 *
 * 说明：
 * - Rust 侧已完成 length-prefix 拆包：前端监听的是 `tcp-frame`（payload only）；
 * - 本类的日志统一通过 `tauriLog` 输出英文，便于跨端检索。
 */
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
        // 通过 tauri 命令在 Rust 侧注册该 TCP service（按 server socket 维度）。
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
    public async sendRaw(server_socket: string, raw_data: string): Promise<void> {
        const bytes = new TextEncoder().encode(raw_data);
        const frame = frameNettyPayload(bytes, this.frameConfig);
        await invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket: server_socket, data: Array.from(frame) });
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
     * @returns 该帧处理完成后 resolve。
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
	                publishIncomingMessage(value, { serverSocket });
	                return;
	            }
	            if (Number.isFinite(id)) {
	                this.funcMap.call(id, value);
	                return;
	            }
	        }

	        // 处理其他消息
	        publishIncomingMessage(value, { serverSocket });
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
 * 创建并初始化某服务端的 `TcpService`（注册到全局 `TCP_SERVICE`，并完成握手）。
 *
 * 行为：
 * - 创建 service 并写入 registry；
 * - 启动换钥/握手流程（mock socket 可跳过等待）；
 * - 初始化失败时从 registry 移除，避免脏数据残留。
 *
 * @param socket - 服务端 socket（作为 registry key）。
 * @param connectSocket - 实际用于原生连接器的传输 socket（默认同 socket）。
 * @returns 已初始化（且在非 mock 下握手完成）的 `TcpService`。
 */
export async function createServerTcpService(socket: string, connectSocket?: string) {
    const serverSocketKey = socket.trim();
    const transportSocket = String(connectSocket ?? serverSocketKey).trim() || serverSocketKey;
    // 参考 `docs/客户端开发指南.md`：
    // Netty 帧：2 字节无符号长度前缀（大端），后跟 payload（长度为 length）。
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
 * 兼容导出：历史拼写 `crateServerTcpService`（应为 `createServerTcpService`）。
 *
 * 说明：
 * - 该别名用于降低改名带来的改动面；
 * - 新增代码请使用 `createServerTcpService`。
 *
 * @param socket - 服务端 socket（作为 registry key）。
 * @param connectSocket - 实际用于原生连接器的传输 socket（默认同 socket）。
 * @returns 已初始化（且在非 mock 下握手完成）的 `TcpService`。
 * @deprecated 请改用 {@link createServerTcpService}。
 */
export async function crateServerTcpService(socket: string, connectSocket?: string) {
    return createServerTcpService(socket, connectSocket);
}

/**
 * @constant
 * @description 全局 TCP service registry（key 为 server socket）。
 */
export const TCP_SERVICE: Map<string,TcpService> = new Map<string,TcpService>();

// 依赖倒置：由 network feature 提供 TcpService 获取方式，供 shared/net 基础设施消费（例如 BaseAPI）。
setTcpServiceProvider((serverSocket: string) => TCP_SERVICE.get(String(serverSocket ?? "").trim()) ?? null);
