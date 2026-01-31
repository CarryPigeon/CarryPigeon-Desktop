/**
 * @fileoverview 握手与 AES-GCM 加密（平台边界）。
 * @description 负责 ECC 握手、AES-GCM 加解密、以及 Netty length-prefix 帧封装；关联文档见 `docs/客户端开发指南.md`。
 */
import { invokeTauri, TAURI_COMMANDS, tauriLog } from "../../../shared/tauri";

type JsonObject = Record<string, unknown>;
type FrameByteOrder = "be" | "le";
type FrameLengthBytes = 2 | 4;

export type FrameConfig = {
    lengthBytes: FrameLengthBytes;
    byteOrder: FrameByteOrder;
    lengthIncludesHeader: boolean;
};

/**
 * crypto/text codec shared by encryption helpers.
 * (Do not export; exported APIs live on `Encryption`.)
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

/**
 * toArrayBuffer 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/**
 * bytesToBase64 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function bytesToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

/**
 * base64ToBytes 方法说明。
 * @param base64 - 参数说明。
 * @returns 返回值说明。
 */
function base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

/**
 * concatBytes 方法说明。
 * @param parts - 参数说明。
 * @returns 返回值说明。
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
 * frameNettyPayload 方法说明。
 * @param payload - 参数说明。
 * @param config - 参数说明。
 * @returns 返回值说明。
 */
function frameNettyPayload(payload: Uint8Array, config: FrameConfig): Uint8Array {
    const headerBytes = config.lengthBytes;
    const totalLength = payload.length + (config.lengthIncludesHeader ? headerBytes : 0);

    if (headerBytes === 2) {
        if (totalLength > 0xffff) throw new Error(`Netty payload too large for u16 length: ${totalLength}`);
        const out = new Uint8Array(headerBytes + payload.length);
        new DataView(out.buffer).setUint16(0, totalLength, config.byteOrder === "le");
        out.set(payload, headerBytes);
        return out;
    }

    const out = new Uint8Array(headerBytes + payload.length);
    new DataView(out.buffer).setUint32(0, totalLength >>> 0, config.byteOrder === "le");
    out.set(payload, headerBytes);
    return out;
}

/**
 * isAllZero 方法说明。
 * @param bytes - 参数说明。
 * @returns 返回值说明。
 */
function isAllZero(bytes: Uint8Array): boolean {
    for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
    return true;
}

/**
 * importServerEccPublicKeySpkiP256 方法说明。
 * @param base64Spki - 参数说明。
 * @returns 返回值说明。
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
 * eciesEncryptP256 方法说明。
 * @param serverPublicKey - 参数说明。
 * @param plaintext - 参数说明。
 * @returns 返回值说明。
 */
async function eciesEncryptP256(serverPublicKey: CryptoKey, plaintext: Uint8Array): Promise<Uint8Array> {
    // Match BouncyCastle "ECIES" defaults (IESEngine + KDF2(SHA1) + HMac(SHA1), no block cipher).
    // Output format: V || C || T
    // - V: ephemeral public key (uncompressed point)
    // - C: ciphertext (XOR with KDF output)
    // - T: HMAC-SHA1 over C (encodingV omitted)
    const MAC_KEY_SIZE_BYTES = 16; // 128-bit macKeySize is the common BC default for ECIES

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
 * sha1 方法说明。
 * @param data - 参数说明。
 * @returns 返回值说明。
 */
    async function sha1(data: Uint8Array): Promise<Uint8Array> {
        const digest = await window.crypto.subtle.digest("SHA-1", toArrayBuffer(data));
        return new Uint8Array(digest);
    }

/**
 * u32be 方法说明。
 * @param value - 参数说明。
 * @returns 返回值说明。
 */
    function u32be(value: number): Uint8Array {
        const out = new Uint8Array(4);
        const view = new DataView(out.buffer);
        view.setUint32(0, value >>> 0, false);
        return out;
    }

/**
 * kdf2Sha1 方法说明。
 * @param z - 参数说明。
 * @param length - 参数说明。
 * @returns 返回值说明。
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
 * buildAad 方法说明。
 * @param sequence - 参数说明。
 * @param sessionId - 参数说明。
 * @param timestampMs - 参数说明。
 * @returns 返回值说明。
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
 * parseAad 方法说明。
 * @param aad - 参数说明。
 * @returns 返回值说明。
 */
function parseAad(aad: Uint8Array): { sequence: number; sessionId: bigint; timestampMs: bigint } {
    if (aad.length !== 20) throw new Error(`Invalid AAD length: ${aad.length}`);
    const view = new DataView(aad.buffer, aad.byteOffset, aad.byteLength);
    const sequence = view.getUint32(0, false);
    const sessionId = view.getBigUint64(4, false);
    const timestampMs = view.getBigUint64(12, false);
    return { sequence, sessionId, timestampMs };
}

export class Encryption {
    private readonly serverSocket: string;
    private serverEccPublicKeyBase64: string | undefined;
    private frameConfig: FrameConfig = { lengthBytes: 2, byteOrder: "be", lengthIncludesHeader: false };

    private aesKey: CryptoKey | undefined;
    private sessionId: bigint = 0n;
    private sendSequence: number = 0;
    private handshakeComplete: boolean = false;

    constructor(serverSocket: string, opts?: { serverEccPublicKeyBase64?: string; frameConfig?: FrameConfig }) {
        this.serverSocket = serverSocket;
        this.serverEccPublicKeyBase64 = opts?.serverEccPublicKeyBase64;
        this.frameConfig = opts?.frameConfig ?? this.frameConfig;
    }

    /**
     * 设置服务端 ECC 公钥（Base64 SPKI，P-256）。
     * @param base64Spki - 服务端 ECC 公钥（Base64 SPKI）
     * @returns void
     */
    public setServerEccPublicKeyBase64(base64Spki: string) {
        this.serverEccPublicKeyBase64 = base64Spki;
    }

    /**
     * 设置 Netty 帧配置（长度前缀）。
     * @param frameConfig - 帧配置
     * @returns void
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
        const isMockSocket = this.serverSocket.startsWith("mock://");
        const isMockKey = this.serverEccPublicKeyBase64 === "mock";
        const isTlsSocket =
            this.serverSocket.startsWith("tls://") || this.serverSocket.startsWith("tls-insecure://");

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
            tauriLog.debug("Mock handshake bypassed", { socket: this.serverSocket });
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
                socket: this.serverSocket,
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
