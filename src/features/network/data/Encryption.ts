/**
 * @fileoverview 握手与 AES-GCM 加密（平台边界）。
 * @description 负责 ECC 握手、AES-GCM 加解密、以及 Netty length-prefix 帧封装；关联文档见 `docs/客户端开发指南.md`。
 */
import { invokeTauri, TAURI_COMMANDS, tauriLog } from "@/shared/tauri";
import { frameNettyPayload, type FrameConfig } from "./frameCodec";

type JsonObject = Record<string, unknown>;

/**
 * 加密辅助函数共享的文本编解码器。
 *
 * 说明：
 * - 不导出；对外 API 统一通过 `Encryption` 暴露。
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

/**
 * 将 `Uint8Array` 视图转换为独立的 `ArrayBuffer` 切片。
 *
 * 说明：
 * WebCrypto API 接受 `ArrayBuffer`/`ArrayBufferView`。这里使用 slice，
 * 用于避免输入 `Uint8Array` 是“大 buffer 的子视图”时带来的边界/偏移隐患。
 *
 * @param bytes - 字节视图。
 * @returns 仅包含 `bytes` 的 `ArrayBuffer` 切片。
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * 使用浏览器内置能力（`btoa`）对字节进行 Base64 编码。
 *
 * @param bytes - 原始字节。
 * @returns Base64 字符串。
 */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * 使用浏览器内置能力（`atob`）将 Base64 字符串解码为字节。
 *
 * @param base64 - Base64 字符串。
 * @returns 解码后的字节数组。
 */
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * 将多个字节数组拼接为一个 `Uint8Array`。
 *
 * @param parts - 字节数组片段。
 * @returns 拼接后的输出。
 */
function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

/**
 * 判断字节数组是否全为 0。
 *
 * @param bytes - 待检查字节。
 * @returns 全为 0 时返回 `true`。
 */
function isAllZero(bytes: Uint8Array): boolean {
    for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
    return true;
}

/**
 * 从 Base64（SPKI）导入服务端 ECC 公钥（P-256）。
 *
 * @param base64Spki - Base64 编码的 SPKI 字节。
 * @returns 可用于 ECDH deriveBits 的 WebCrypto key。
 */
async function importServerEccPublicKeySpkiP256(base64Spki: string): Promise<CryptoKey> {
    const spkiBytes = base64ToBytes(base64Spki);
    try {
        return await window.crypto.subtle.importKey(
            "spki",
            toArrayBuffer(spkiBytes),
            { name: "ECDH", namedCurve: "P-256" },
            false,
            []
        );
    } catch (e) {
        throw new Error(`Failed to import server ECC public key (SPKI, P-256): ${e}`);
    }
}

/**
 * 基于 P-256 ECDH 的 ECIES-like 方案加密 payload。
 *
 * 说明：
 * - 该实现对齐常见的 BouncyCastle ECIES 配置（KDF2(SHA1) + HMAC(SHA1)）。
 * - 输出格式：`V || C || T`
 *   - `V`：临时公钥（非压缩点）
 *   - `C`：密文（与 KDF 输出 XOR）
 *   - `T`：对 `C` 的 HMAC-SHA1 tag
 *
 * @param serverPublicKey - 服务端 ECDH 公钥（P-256）。
 * @param plaintext - 明文字节。
 * @returns 密文字节。
 */
async function eciesEncryptP256(serverPublicKey: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
    // 对齐 BouncyCastle 的 ECIES 默认配置（IESEngine + KDF2(SHA1) + HMac(SHA1)，无分组密码）。
    // 输出格式：V || C || T
    // - V：临时公钥（非压缩点）
    // - C：密文（与 KDF 输出 XOR）
    // - T：对 C 的 HMAC-SHA1（此处不包含 encodingV）
    // 说明：16 字节（128-bit）是 BouncyCastle ECIES 常见的默认 MAC key size。
    const MAC_KEY_SIZE_BYTES = 16;

    const eph = await window.crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
    );

    const sharedSecretBits = await window.crypto.subtle.deriveBits(
        { name: "ECDH", public: serverPublicKey },
        eph.privateKey,
        256
    );

    const sharedSecret = new Uint8Array(sharedSecretBits);
    const ephPublicRaw = new Uint8Array(await window.crypto.subtle.exportKey("raw", eph.publicKey));

    /**
     * 计算 SHA-1 摘要（用于 KDF2 与 HMAC key 派生）。
     *
     * @param data - 输入字节。
     * @returns SHA-1 摘要字节。
     */
    async function sha1(data: Uint8Array): Promise<Uint8Array> {
        const digest = await window.crypto.subtle.digest("SHA-1", toArrayBuffer(data));
        return new Uint8Array(digest);
    }

    /**
     * 将无符号 32-bit 整数编码为大端字节序。
     *
     * @param value - 无符号 32-bit 整数。
     * @returns 4 字节大端编码。
     */
    function u32be(value: number): Uint8Array {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setUint32(0, value >>> 0, false);
        return out;
    }

    /**
     * KDF2（digest 使用 SHA-1）。
     *
     * @param z - 共享密钥字节。
     * @param length - 输出长度（字节）。
     * @returns 派生出的 key 字节。
     */
    async function kdf2Sha1(z: Uint8Array, length: number): Promise<Uint8Array> {
        const out = new Uint8Array(length);
        let written = 0;
        let counter = 1;
        while (written < length) {
            const block = await sha1(concatBytes(z, u32be(counter)));
            const take = Math.min(block.length, length - written);
            out.set(block.slice(0, take), written);
            written += take;
            counter += 1;
        }
        return out;
    }

    const kdf = await kdf2Sha1(sharedSecret, plaintext.length + MAC_KEY_SIZE_BYTES);
    const k1 = kdf.slice(0, plaintext.length);
    const k2 = kdf.slice(plaintext.length);

    const cipherText = new Uint8Array(plaintext.length);
    for (let i = 0; i < plaintext.length; i++) cipherText[i] = plaintext[i] ^ k1[i];

    const hmacKey = await window.crypto.subtle.importKey(
        "raw",
        toArrayBuffer(k2),
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    );
    const tag = new Uint8Array(await window.crypto.subtle.sign("HMAC", hmacKey, toArrayBuffer(cipherText)));

    return concatBytes(ephPublicRaw, cipherText, tag);
}

/**
 * 构建 AES-GCM 的 AAD（additional authenticated data）。
 *
 * 布局（20 字节）：
 * - u32 sequence
 * - u64 sessionId
 * - u64 timestampMs
 *
 * @param sequence - 消息序号。
 * @param sessionId - 会话 id。
 * @param timestampMs - 时间戳（ms）。
 * @returns AAD 字节。
 */
function buildAad(sequence: number, sessionId: bigint, timestampMs: bigint): Uint8Array {
    const aad = new Uint8Array(20);
    const view = new DataView(aad.buffer);
    view.setUint32(0, sequence >>> 0, false);
    view.setBigUint64(4, BigInt.asUintN(64, sessionId), false);
    view.setBigUint64(12, BigInt.asUintN(64, timestampMs), false);
    return aad;
}

/**
 * 将 AAD 字节反解析为结构化字段。
 *
 * @param aad - AAD 字节。
 * @returns 解析后的字段。
 */
function parseAad(aad: Uint8Array): { sequence: number; sessionId: bigint; timestampMs: bigint } {
    if (aad.length !== 20) throw new Error(`Invalid AAD length: ${aad.length}`);
    const view = new DataView(aad.buffer, aad.byteOffset, aad.byteLength);
    const sequence = view.getUint32(0, false);
    const sessionId = view.getBigUint64(4, false);
    const timestampMs = view.getBigUint64(12, false);
    return { sequence, sessionId, timestampMs };
}

/**
 * 加密器（平台边界 / 状态机）。
 *
 * 职责：
 * - 在连接建立后发起换钥（`swapKey`），并等待服务端 `/handshake` 返回 `session_id`；
 * - 对业务 JSON 文本做 AES-GCM 加解密，并与 Rust 侧的 Netty 拆包协议对齐封帧；
 * - 在握手前后对 session/sequence 等状态进行维护与校验。
 *
 * 说明：
 * - 本类不负责拆包（deframe）；Rust 侧会先按 length-prefix 拆成单帧再投递到前端。
 * - 日志统一通过 `tauriLog` 输出英文，便于跨端检索。
 */
export class Encryption {
    /**
     * 逻辑服务端 socket（用于索引、日志与 registry key）。
     */
    private readonly serverSocket: string;
    /**
     * 传输层 socket（可能与 serverSocket 不同，例如 tls:// 或 mock://）。
     */
    private readonly transportSocket: string;
    /**
     * 服务端 ECC 公钥（Base64 SPKI，P-256）。
     *
     * 用途：
     * - 兼容旧链路：在非 TLS 传输下，用 ECIES-like 方案加密 `aes_key_base64`。
     * - 若走 TLS，可不配置（推荐直接明文发送 AES key，因为传输层已加密）。
     */
    private serverEccPublicKeyBase64: string | undefined;
    /**
     * length-prefix 帧配置（与 Rust/Netty 拆包保持一致）。
     */
    private frameConfig: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };

    /**
     * 当前会话的 AES-GCM key（通过 `swapKey` 初始化）。
     */
    private aesKey: CryptoKey | undefined;
    /**
     * 服务端握手返回的 session id（大整数）。
     */
    private sessionId: bigint = 0n;
    /**
     * 发送序号（写入 AAD，用于服务端做重放/排序控制）。
     */
    private sendSequence: number = 0;
    /**
     * 是否已完成握手（收到 `/handshake` 后置为 true）。
     */
    private handshakeComplete: boolean = false;

    constructor(serverSocket: string, opts?: { transportSocket?: string; serverEccPublicKeyBase64?: string; frameConfig?: FrameConfig }) {
        this.serverSocket = serverSocket;
        this.transportSocket = String(opts?.transportSocket ?? serverSocket).trim() || serverSocket;
        this.serverEccPublicKeyBase64 = opts?.serverEccPublicKeyBase64;
        this.frameConfig = opts?.frameConfig ?? this.frameConfig;
    }

    /**
     * 设置服务端 ECC 公钥（Base64 SPKI，P-256）。
     * @param base64Spki - 服务端 ECC 公钥（Base64 SPKI）
     * @returns 无返回值。
     */
    public setServerEccPublicKeyBase64(base64Spki: string) {
        this.serverEccPublicKeyBase64 = base64Spki;
    }

    /**
     * 设置 Netty 帧配置（长度前缀）。
     * @param frameConfig - 帧配置
     * @returns 无返回值。
     */
    public setFrameConfig(frameConfig: FrameConfig) {
        this.frameConfig = frameConfig;
    }

    /**
     * 获取当前帧配置。
     * @returns 帧配置
     */
    public getFrameConfig(): FrameConfig {
        return this.frameConfig;
    }

    /**
     * 当前连接是否完成握手。
     * @returns 是否握手完成
     */
    public isHandshakeComplete(): boolean {
        return this.handshakeComplete;
    }

    /**
     * 尝试用“文本”解析握手响应（避免 `session_id` 超过 JS 安全整数导致精度丢失）。
     * @param text - 明文 JSON 文本
     * @returns 是否解析并完成握手
     */
    public tryHandleHandshakeResponseText(text: string): boolean {
        if (!text || typeof text !== "string") return false;
        if (!text.includes("\"route\"") || !text.includes("handshake") || !text.includes("session_id")) return false;

        try {
            const routeOk = /"route"\s*:\s*"handshake"/.test(text);
            if (!routeOk) return false;

            const match = /"session_id"\s*:\s*(?:"(\d+)"|(\d+))/.exec(text);
            const digits = match?.[1] ?? match?.[2];
            if (!digits) return false;

            const sessionId = BigInt(digits);
            if (sessionId <= 0n) throw new Error(`Invalid session_id: ${digits}`);

            this.sessionId = sessionId;
            this.sendSequence = 0;
            this.handshakeComplete = true;
            tauriLog.debug("Handshake complete", { sessionId: this.sessionId.toString() });
            return true;
        } catch (e) {
            tauriLog.error("Handshake response parse failed", { error: String(e) });
            return false;
        }
    }

    /**
     * 尝试用“对象”解析握手响应（要求 `session_id` 在安全整数范围）。
     * @param value - 解析后的 JSON 对象
     * @returns 是否解析并完成握手
     */
    public tryHandleHandshakeResponse(value: unknown): boolean {
        if (!value || typeof value !== "object") return false;
        const obj = value as JsonObject;
        if (obj["id"] !== -1 || obj["code"] !== 0) return false;
        const data = obj["data"];
        if (!data || typeof data !== "object") return false;
        const route = (data as JsonObject)["route"];
        if (route !== "handshake") return false;
        const inner = (data as JsonObject)["data"];
        if (!inner || typeof inner !== "object") return false;
        const sid = (inner as JsonObject)["session_id"];
        if (typeof sid !== "number" && typeof sid !== "string") return false;

        try {
            if (typeof sid === "number" && !Number.isSafeInteger(sid)) {
                throw new Error("session_id exceeds JS safe integer; use tryHandleHandshakeResponseText() path");
            }
            const sessionId = typeof sid === "number" ? BigInt(Math.trunc(sid)) : BigInt(sid);
            if (sessionId <= 0n) throw new Error(`Invalid session_id: ${sid}`);
            this.sessionId = sessionId;
            this.sendSequence = 0;
            this.handshakeComplete = true;
            tauriLog.debug("Handshake complete", { sessionId: this.sessionId.toString() });
            return true;
        } catch (e) {
            tauriLog.error("Handshake response parse failed", { error: String(e) });
            return false;
        }
    }

    /**
     * 发起握手：生成 AES key，并发送 `CPAESKeyPack`。
     *
     * Key 传递策略：
     * - 推荐：在 TLS 连接内以明文发送 `aes_key_base64`（避免再做 ECC 加密）
     * - 兼容：若配置了服务端 ECC 公钥，可继续走 ECC->AES 的旧路径
     *
     * @param requestId - 请求 id（用于日志追踪）
     * @returns Promise<void>
     */
    public async swapKey(requestId: number): Promise<void> {
        const isMockSocket = this.transportSocket.startsWith("mock://");
        const isMockKey = this.serverEccPublicKeyBase64 === "mock";
        const isTlsSocket =
            this.transportSocket.startsWith("tls://") ||
            this.transportSocket.startsWith("tls-insecure://") ||
            this.transportSocket.startsWith("tls-fp://");

        if (isMockSocket || isMockKey) {
            const rawAesKey = window.crypto.getRandomValues(new Uint8Array(16));
            this.aesKey = await window.crypto.subtle.importKey(
                "raw",
                toArrayBuffer(rawAesKey),
                "AES-GCM",
                false,
                ["encrypt", "decrypt"]
            );
            this.sessionId = 1n;
            this.sendSequence = 0;
            this.handshakeComplete = true;
            tauriLog.debug("Mock handshake bypassed", { socket: this.transportSocket });
            return;
        }

        const shouldUseEcc = Boolean(this.serverEccPublicKeyBase64 && !isTlsSocket);

        try {
            const rawAesKey = window.crypto.getRandomValues(new Uint8Array(16));
            this.aesKey = await window.crypto.subtle.importKey("raw", toArrayBuffer(rawAesKey), "AES-GCM", false, ["encrypt", "decrypt"]);
            this.sessionId = 0n;
            this.sendSequence = 0;
            this.handshakeComplete = false;

            const aesKeyBase64 = bytesToBase64(rawAesKey);
            const keyForServer = shouldUseEcc
                ? (() => {
                      if (!this.serverEccPublicKeyBase64) {
                          throw new Error("Missing server ECC public key (Base64 SPKI).");
                      }
                      return this.serverEccPublicKeyBase64;
                  })()
                : null;

            const keyPayload = shouldUseEcc
                ? bytesToBase64(
                      await eciesEncryptP256(
                          await importServerEccPublicKeySpkiP256(keyForServer!),
                          encoder.encode(aesKeyBase64),
                      ),
                  )
                : aesKeyBase64;

            const keyPack = {
                id: requestId,
                session_id: 0,
                key: keyPayload,
            };

            const json = JSON.stringify(keyPack);
            const nonceAndAAD = new Uint8Array(32);
            const payload = encoder.encode(json);
            const out = new Uint8Array(32 + payload.length);
            out.set(nonceAndAAD, 0);
            out.set(payload, 32);
            const framed = frameNettyPayload(out, this.frameConfig);
            const redacted = json.replace(
                /"key":"[^"]*"/,
                `"key":"<redacted:${String(keyPayload).length}>"`
            );

            await invokeTauri(TAURI_COMMANDS.sendTcpService, { serverSocket: this.serverSocket, data: Array.from(framed) });
            const prefixHex = Array.from(framed.slice(0, this.frameConfig.lengthBytes + 6))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join(" ");
            tauriLog.debug("Handshake request sent", {
                id: requestId,
                serviceKey: this.serverSocket,
                socket: this.transportSocket,
                payloadLen: payload.length,
                frameLen: framed.length,
                prefix: prefixHex,
                frameConfig: this.frameConfig,
                pack: redacted,
            });
        } catch (e) {
            tauriLog.error("Handshake request failed", { error: String(e) });
            throw e;
        }
    }

    /**
     * 加密并封帧业务 JSON 文本（AES-GCM + Netty length-prefix）。
     * @param plaintextJson - 业务 JSON 文本
     * @returns 加密并封帧后的字节数组
     */
    public async encrypt(plaintextJson: string): Promise<Uint8Array> {
        if (!this.aesKey) throw new Error("AES key is not initialized; call swapKey() first.");
        if (!this.handshakeComplete) throw new Error("Handshake not complete; wait for /handshake before sending business packets.");

        const nonce = window.crypto.getRandomValues(new Uint8Array(12));
        const aad = buildAad(this.sendSequence, this.sessionId, BigInt(Date.now()));
        const plaintext = encoder.encode(plaintextJson);

        try {
            const encrypted = await window.crypto.subtle.encrypt(
                { name: "AES-GCM", iv: toArrayBuffer(nonce), additionalData: toArrayBuffer(aad), tagLength: 128 },
                this.aesKey,
                toArrayBuffer(plaintext)
            );
            const payload = concatBytes(nonce, aad, new Uint8Array(encrypted));
            const framed = frameNettyPayload(payload, this.frameConfig);
            this.sendSequence = (this.sendSequence + 1) >>> 0;
            return framed;
        } catch (e) {
            tauriLog.error("AES-GCM encrypt failed", { error: String(e) });
            throw e;
        }
    }

    /**
     * 解密业务帧 payload（不包含长度头）。
     * @param framePayload - 解密前的帧 payload
     * @returns 明文 JSON 文本；若为 keepalive/空包则可能为 null
     */
    public async decrypt(framePayload: Uint8Array): Promise<string | null> {
        if (!this.aesKey) throw new Error("AES key is not initialized; cannot decrypt.");
        if (framePayload.length < 32) throw new Error(`Invalid encrypted payload length: ${framePayload.length}`);

        const nonce = framePayload.slice(0, 12);
        const aad = framePayload.slice(12, 32);
        const cipherText = framePayload.slice(32);

        if (cipherText.length === 0 && isAllZero(nonce)) {
            return null;
        }

        const { sessionId } = parseAad(aad);
        if (this.handshakeComplete && sessionId !== this.sessionId) {
            throw new Error(`Session id mismatch: got ${sessionId.toString()}, expected ${this.sessionId.toString()}`);
        }

        try {
            const decrypted = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: toArrayBuffer(nonce), additionalData: toArrayBuffer(aad), tagLength: 128 },
                this.aesKey,
                toArrayBuffer(cipherText)
            );
            return decoder.decode(decrypted);
        } catch (e) {
            tauriLog.error("AES-GCM decrypt failed", { error: String(e) });
            throw e;
        }
    }
}
