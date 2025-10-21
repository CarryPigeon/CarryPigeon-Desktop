import * as CryptoJS from "crypto-js";
import {TcpService} from "../net/TcpService";
import {generateECCKeyPair} from "./ECC";

export interface EncryptInterface {
    encrypt: (data: string) => string
    decrypt: (data: string) => string
}

export abstract class EncryptClass implements EncryptInterface {
    //protected constructor(socket: string) ;
    public abstract encrypt(data: string): string;
    public abstract decrypt(data: string): string;
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

    /**
     * 第三方加密
     * @param data 待加密数据
     * @returns 加密后数据
     */
    public encrypt(data: string): string {
        return this.encryptClass.encrypt(data);
    }

    /**
     * 第三方解密
     * @param data 待解密数据
     * @returns 解密后数据
     */
    public decrypt(data: string): string {
        return this.encryptClass.decrypt(data);
    }
}

export class OfficialEncryptClass implements EncryptInterface {
    public instance: TcpService;
    private ECCPrivateKey: CryptoKey | undefined;
    private AESKey: string | undefined;

    constructor(socket: string) {
        this.instance = new TcpService(socket);
    }

    private async sendECCPrivateKey(userId: number) {
        const ECCKeyPair = await generateECCKeyPair();
        this.ECCPrivateKey = ECCKeyPair.privateKey;
        const body = {
            "id": userId,
            "key": ECCKeyPair.publicKey,
        }
        const bodyJson = JSON.stringify(body);
        return this.instance.send(bodyJson);
    }

    private async decryptAESKey(data: string) {
        if (this.ECCPrivateKey === undefined) {
            throw new Error("ECCPrivateKey is undefined");
        }
        const body = JSON.parse(data);
        try {
            const tmp = await window.crypto.subtle.decrypt(
                {
                    name: "ECDSA",
                },
                this.ECCPrivateKey,
                body.key,
            );
            const decoder = new TextDecoder('utf-8');
            this.AESKey = decoder.decode(tmp);
        } catch (e) {
        }
    }

    public async swapKey(userId: number) {
        await this.sendECCPrivateKey(userId);
        this.instance.client.once("swapKey", (data: string) => {
                this.decryptAESKey(data);
            });
    }

    public encrypt(data: string): string {
        if (this.AESKey === undefined) {
            throw new Error("AESKey is undefined");
        }
        return CryptoJS.AES.encrypt(data, this.AESKey).toString();
    }

    public decrypt(data: string): string {
        if (this.AESKey === undefined) {
            throw new Error("AESKey is undefined");
        }
        return CryptoJS.AES.decrypt(data, this.AESKey).toString();
    }
}

