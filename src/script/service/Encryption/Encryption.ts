import {generateECDHKeyPair, deriveSharedSecret, importAESKey, encryptAESGCM, decryptAESGCM} from "./ECC";
import { invoke } from "@tauri-apps/api/core";

export interface EncryptInterface {
    encrypt: (data: string) => Promise<string>
    decrypt: (data: string) => Promise<string>
    decryptAESKey(key: string): Promise<void>
    swapKey(userId: number): Promise<void>
}

export abstract class EncryptClass implements EncryptInterface {
    public abstract encrypt(data: string): Promise<string>;
    public abstract decrypt(data: string): Promise<string>;
    public abstract decryptAESKey(key: string): Promise<void>;
    public abstract swapKey(userId: number): Promise<void>;
}

export type EncryptClassWithConstructor<T extends EncryptClass> = new (socket: string) => T;

export class Encryption {
    private encryptClass: EncryptInterface;

    constructor(socket: string, encryptClass?: EncryptClassWithConstructor<EncryptClass>) {
        if(encryptClass) {
            this.encryptClass = new encryptClass(socket);
        } else {
            this.encryptClass = new OfficialEncryptClass(socket);
        }
    }

    public async encrypt(data: string): Promise<string> {
        return this.encryptClass.encrypt(data);
    }

    public async decrypt(data: string): Promise<string> {
        return this.encryptClass.decrypt(data);
    }

    public async decryptAESKey(key: string) {
        await this.encryptClass.decryptAESKey(key);
    }

    public async swapKey(userId: number) {
        await this.encryptClass.swapKey(userId);
    }
}

export class OfficialEncryptClass implements EncryptInterface {
    private ECCPrivateKey: CryptoKey | undefined;
    private AESKey: CryptoKey | undefined;
    private server_socket: string;
    private sessionId: string | undefined;

    constructor(socket: string) {
        this.server_socket = socket;
    }

    private async sendECCPrivateKey(userId: number) {
        // 使用ECDH密钥对进行密钥交换
        const ECCKeyPair = await generateECDHKeyPair();
        this.ECCPrivateKey = ECCKeyPair.privateKey;
        
        // 构造密钥交换消息，按照指定格式
        const body = {
            "id": userId,
            "key": ECCKeyPair.publicKey
        };
        
        const bodyJson = JSON.stringify(body);
        
        try {
            // 添加换行符作为消息分隔符
            const message = bodyJson + '\n';
            await invoke("send_tcp_service", { serverSocket: this.server_socket, data: message });
            invoke("log_debug", {msg: `Sent ECC Public Key to User ${userId}, socket: ${this.server_socket}, data: ${message}`});
        } catch (e) {
            invoke("log_error", {error: `Failed to send ECC Public Key: ${e}`});
            throw e;
        }
    }

    public async decryptAESKey(data: string) {
        if (this.ECCPrivateKey === undefined) {
            throw new Error("ECCPrivateKey is undefined");
        }
        
        let body;
        try {
            body = JSON.parse(data);
        } catch (e) {
            throw new Error("Invalid JSON format: " + e);
        }
        
        try {
            // 验证接收到的JSON格式，session_id是可选的
            if (body.id === undefined || !body.key) {
                throw new Error("Missing required fields in response");
            }
            
            // 检查body.key的格式
            let sharedSecret: string;
            if (body.key.length > 200) {
                // 长字符串，可能是ECC公钥JWK
                sharedSecret = await deriveSharedSecret(this.ECCPrivateKey, body.key);
            } else {
                // 短字符串或二进制数据转换的Base64，可能是直接的共享密钥
                // 直接使用body.key作为共享密钥
                sharedSecret = body.key;
                invoke("log_debug", {msg: "Using direct shared secret from server"});
            }
            
            // 导入AES密钥
            this.AESKey = await importAESKey(sharedSecret);
            this.sessionId = body.session_id || `session_${Date.now()}`;
            
            invoke("log_debug", {msg: `AES Key derived successfully, session_id: ${this.sessionId}`});
        } catch (e) {
            invoke("log_error", {error: `Decrypt AES Key Failed: ${e}`});
            throw e;
        }
    }

    public async swapKey(userId: number) {
        await this.sendECCPrivateKey(userId);
    }

    public async encrypt(data: string): Promise<string> {
        if (this.AESKey === undefined) {
            throw new Error("AESKey is undefined");
        }
        
        try {
            // 使用AES-GCM加密数据
            const encrypted = await encryptAESGCM(data, this.AESKey);
            
            // 返回包含密文、nonce和标签的JSON格式
            return JSON.stringify({
                ciphertext: encrypted.ciphertext,
                nonce: encrypted.nonce,
                tag: encrypted.tag
            });
        } catch (e) {
            invoke("log_error", {error: `Encryption failed: ${e}`});
            throw e;
        }
    }

    public async decrypt(data: string): Promise<string> {
        if (this.AESKey === undefined) {
            throw new Error("AESKey is undefined");
        }
        
        let encryptedData;
        try {
            encryptedData = JSON.parse(data);
        } catch (e) {
            throw new Error("Invalid encrypted data format: " + e);
        }
        
        try {
            // 验证加密数据格式
            if (!encryptedData.ciphertext || !encryptedData.nonce || !encryptedData.tag) {
                throw new Error("Missing required fields in encrypted data");
            }
            
            // 使用AES-GCM解密数据
            return await decryptAESGCM(
                encryptedData.ciphertext,
                encryptedData.nonce,
                encryptedData.tag,
                this.AESKey
            );
        } catch (e) {
            invoke("log_error", {error: `Decryption failed: ${e}`});
            throw e;
        }
    }
}
