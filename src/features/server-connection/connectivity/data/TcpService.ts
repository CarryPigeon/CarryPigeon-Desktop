/**
 * @fileoverview TCP 服务（收发、拆包、握手协同）。
 * @description 平台边界模块：负责握手/解密，并将业务消息分发到前端消息处理链路；Netty 长度拆包由 Rust 侧完成。
 */
import { invokeTauri, TAURI_COMMANDS, tauriLog } from "@/shared/tauri";
import { publishIncomingMessage } from "@/shared/net/incomingMessageSink";
import { Encryption } from "./Encryption";
import { frameNettyPayload, type FrameConfig } from "./frameCodec";
import { HandshakeWaitState } from "./HandshakeWaitState";
import { TcpRequestCallbackRegistry } from "./TcpRequestCallbackRegistry";
import { createTcpRequestResponseSender } from "./TcpRequestResponseSender";

const KEY_EXCHANGE_TIMEOUT_MS = 15_000;
const RESPONSE_CALLBACK_TIMEOUT_MS = 15_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * TCP 服务（数据层 / 平台边界）。
 *
 * 职责：
 * - 通过 Tauri 命令驱动 Rust 侧建立连接（按 server_socket 维度注册）；
 * - 与 `Encryption` 协同完成换钥与握手；
 * - 解密来自 Rust 侧的单帧 payload，并分发到消息处理链路；
 * - 提供 request/response 风格回调映射（request id）。
 *
 * 说明：
 * - Rust 侧已完成 length-prefix 拆包：前端监听的是 `tcp-frame`（payload only）；
 * - 本类的日志统一通过 `tauriLog` 输出英文，便于跨端检索。
 */
export class TcpService {
  private readonly encrypter: Encryption;
  private readonly callbackRegistry: TcpRequestCallbackRegistry;
  private readonly callbackTimeoutById = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly handshakeWaitState = new HandshakeWaitState();
  private readonly sendWithResponseHandler: (serverSocket: string, rawData: string) => Promise<unknown>;
  private initPromise: Promise<unknown>;
  public readonly frameConfig: FrameConfig;

  constructor(serverSocketKey: string, transportSocket: string, opts?: { frameConfig?: FrameConfig }) {
    this.callbackRegistry = new TcpRequestCallbackRegistry();
    this.frameConfig = opts?.frameConfig ?? { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };
    this.encrypter = new Encryption(serverSocketKey, { transportSocket, frameConfig: this.frameConfig });
    // 通过 tauri 命令在 Rust 侧注册该 TCP service（按 server socket 维度）。
    this.initPromise = invokeTauri(TAURI_COMMANDS.addTcpService, {
      serverSocket: serverSocketKey,
      socket: transportSocket,
    });
    this.sendWithResponseHandler = createTcpRequestResponseSender({
      callbackRegistry: this.callbackRegistry,
      callbackTimeoutById: this.callbackTimeoutById,
      encrypt: (rawData: string) => this.encrypter.encrypt(rawData),
      responseCallbackTimeoutMs: RESPONSE_CALLBACK_TIMEOUT_MS,
    });
  }

  /**
   * 等待 Rust 侧 TCP service 注册完成。
   * @returns Promise<void>
   */
  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  /**
   * 等待握手完成（收到 `/handshake`）。
   * @param timeoutMs - 超时时间（毫秒）
   * @returns Promise<void>
   */
  public waitForKeyExchange(timeoutMs: number = KEY_EXCHANGE_TIMEOUT_MS): Promise<void> {
    return this.handshakeWaitState.wait(() => this.encrypter.isHandshakeComplete(), timeoutMs);
  }

  /**
   * 触发换钥流程（握手前）。
   *
   * @param code - 换钥指令码。
   */
  public async swapKey(code: number): Promise<void> {
    await this.encrypter.swapKey(code);
  }

  /**
   * 判断握手是否已完成。
   *
   * @returns 已完成返回 `true`。
   */
  public isHandshakeComplete(): boolean {
    return this.encrypter.isHandshakeComplete();
  }

  /**
   * 将单帧 payload 解码为明文字符串。
   *
   * 行为：
   * - 优先按握手态解密；
   * - 若未握手完成且解密失败，则回退 UTF-8 明文解码（兼容握手前文）；
   * - 失败返回 `null`。
   *
   * @param framePayload - 单帧 payload。
   * @returns 明文字符串或 `null`。
   */
  public async decodeIncomingFrame(framePayload: Uint8Array): Promise<string | null> {
    if (framePayload.length === 0) return null;
    try {
      return await this.encrypter.decrypt(framePayload);
    } catch (error) {
      if (this.encrypter.isHandshakeComplete()) {
        tauriLog.error("Action: network_frame_decrypt_failed_after_handshake", { error: String(error) });
        return null;
      }
      try {
        return new TextDecoder("utf-8").decode(framePayload);
      } catch {
        tauriLog.error("Action: network_frame_decode_failed", { error: String(error) });
        return null;
      }
    }
  }

  /**
   * 销毁当前 service 的本地状态（握手等待 + 回调映射）。
   *
   * 说明：
   * - 仅清理前端进程内状态；
   * - Rust 侧连接释放由外层 `disposeTcpServiceByKey` 调用 `remove_tcp_service` 处理。
   */
  public dispose(): void {
    for (const timer of this.callbackTimeoutById.values()) {
      clearTimeout(timer);
    }
    this.callbackTimeoutById.clear();
    this.handshakeWaitState.rejectIfPending(new Error("TcpService disposed"));
    this.callbackRegistry.clear();
  }

  /**
   * 发送 JSON 文本（会按握手状态进行加密/封帧）。
   * @param serverSocket - 目标服务端 socket
   * @param rawData - 原始 JSON 文本
   * @param callback - 可选：Rust 侧返回文本回调
   * @returns Promise<void>
   */
  public async send(serverSocket: string, rawData: string, callback?: (data: string) => void): Promise<void> {
    try {
      const data = await this.encrypter.encrypt(rawData);
      const response = await invokeTauri(TAURI_COMMANDS.sendTcpService, {
        serverSocket,
        data: Array.from(data),
      });
      if (callback) callback(response as string);
    } catch (error) {
      tauriLog.error("Action: network_tcp_send_failed", { error: String(error) });
      throw error;
    }
  }

  /**
   * 发送明文帧（不加密，仅 length-prefix 封帧）。
   * @param serverSocket - 目标服务端 socket
   * @param rawData - 明文 JSON 文本
   * @returns Promise<void>
   */
  public async sendRaw(serverSocket: string, rawData: string): Promise<void> {
    const bytes = new TextEncoder().encode(rawData);
    const frame = frameNettyPayload(bytes, this.frameConfig);
    await invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket, data: Array.from(frame) });
  }

  /**
   * 发送请求并等待响应（通过 request id 关联回包）。
   * @param serverSocket - 目标服务端 socket
   * @param rawData - 原始 JSON 文本（会在内部注入 `id` 字段）
   * @returns Promise<unknown> - 回包原始对象。
   */
  public sendWithResponse(serverSocket: string, rawData: string): Promise<unknown> {
    return this.sendWithResponseHandler(serverSocket, rawData);
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
    if (this.encrypter.tryHandleHandshakeResponseText(data)) {
      this.resolveHandshakeIfPending();
      return;
    }

    const value = this.parseIncomingJson(data);
    if (value === null) return;

    tauriLog.debug("Action: network_tcp_message_received", { value });

    if (this.encrypter.tryHandleHandshakeResponse(value)) {
      this.resolveHandshakeIfPending();
      return;
    }

    if (isRecord(value) && this.routeMessageByCallbackId(value, serverSocket)) {
      return;
    }

    publishIncomingMessage(value, { serverSocket });
  }

  private resolveHandshakeIfPending(): void {
    this.handshakeWaitState.resolveIfPending((error) => {
      tauriLog.error("Action: network_handshake_failed", { error: String(error) });
    });
  }

  private parseIncomingJson(data: string): unknown | null {
    try {
      return JSON.parse(data) as unknown;
    } catch (error) {
      // 可能是不完整消息或非 JSON 文本，直接记录并忽略该帧。
      tauriLog.error("Action: network_json_parse_failed", { error: String(error) });
      return null;
    }
  }

  /**
   * 处理带 `id` 的 request/response 协议包。
   *
   * @returns `true` 表示该消息已被视为 callback 协议包并完成处理。
   */
  private routeMessageByCallbackId(message: Record<string, unknown>, serverSocket: string): boolean {
    if (message["id"] === undefined) return false;

    const id = Number(message["id"]);
    const code = Number(message["code"]);
    if (!Number.isFinite(id)) {
      tauriLog.warn("Action: network_tcp_response_invalid_callback_id", { id: message["id"], serverSocket });
      return true;
    }

    if (id === -1) {
      if (code === 0 && message["data"] !== undefined) {
        publishIncomingMessage(message, { serverSocket });
      } else {
        tauriLog.warn("Action: network_tcp_push_packet_invalid_shape", { id, code, serverSocket });
      }
      return true;
    }

    if (id >= 0) {
      const handled = this.callbackRegistry.call(id, message);
      if (!handled) {
        tauriLog.warn("Action: network_tcp_response_unmatched_callback_id", { id, serverSocket });
      }
      return true;
    }

    tauriLog.warn("Action: network_tcp_response_unsupported_callback_id", { id, serverSocket });
    return true;
  }
}
