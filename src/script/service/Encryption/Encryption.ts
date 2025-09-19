import {AxiosInstance} from "axios";
import * as CryptoJS from "crypto-js";
import {createConnection} from "../net/TcpService";
import {generateECCKeyPair} from "./ECC";

interface EncryptClass {
    encrypt: (data: string) => string
    decrypt: (data: string) => string
}

export class OfficialEncryptClass implements EncryptClass {
    public instance: AxiosInstance;
    private ECCPrivateKey: CryptoKey | undefined;
    private AESKey: string | undefined;

    constructor(socket: string) {
        this.instance = createConnection(socket);
    }

    private async sendECCPrivateKey(userId: number) {
        const ECCKeyPair = await generateECCKeyPair();
        this.ECCPrivateKey = ECCKeyPair.privateKey;
        const body = {
            "id": userId,
            "key": ECCKeyPair.publicKey,
        }
        const bodyJson = JSON.stringify(body);
        return this.instance.post(bodyJson);
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
        const result = await this.sendECCPrivateKey(userId);
        if ( result.status === 200){
            await this.decryptAESKey(result.data);
        } else {
            throw new Error("swap key error");
        }
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

export interface Encryption {

    /**
     * 第三方加密
     * @param data 待加密数据
     * @returns 加密后数据
     */
    encrypt(data: string): string;

    /**
     * 第三方解密
     * @param data 待解密数据
     * @returns 解密后数据
     */
    decrypt(data: string): string;
}