export async function generateECDHKeyPair(): Promise<{privateKey: CryptoKey, publicKey: string}> {
    // 生成ECDH密钥对用于密钥交换 (secp256r1 曲线，即 P-256)
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDH",
            namedCurve: "P-256", // secp256r1 对应 P-256
        },
        true,
        ["deriveKey", "deriveBits"],
    );
    
    // 导出公钥为JWK格式
    const jwkPublicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey);
    
    // 将JWK公钥转换为base64字符串发送给服务器
    const publicKeyBase64 = btoa(JSON.stringify(jwkPublicKey));
    
    return { privateKey: keyPair.privateKey, publicKey: publicKeyBase64 };
}

export async function deriveSharedSecret(privateKey: CryptoKey, publicKeyJwk: string): Promise<string> {
    let jwk;
    try {
        // 尝试直接解析JSON（如果是原始JSON字符串）
        jwk = JSON.parse(publicKeyJwk);
    } catch {
        try {
            // 如果直接解析失败，尝试先base64解码再解析
            jwk = JSON.parse(atob(publicKeyJwk));
        } catch (e) {
            console.error("Failed to parse public key JWK:", e);
            throw new Error("Invalid public key format");
        }
    }
    
    // 导入服务器公钥
    const publicKey = await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        {
            name: "ECDH",
            namedCurve: "P-256", // secp256r1 对应 P-256
        },
        true,
        []
    );
    
    // 派生共享密钥 - 使用AES-GCM-128
    const sharedSecret = await window.crypto.subtle.deriveKey(
        {
            name: "ECDH",
            public: publicKey,
        },
        privateKey,
        {
            name: "AES-GCM",
            length: 128, // 128-bit key for AES-GCM
        },
        true,
        ["encrypt", "decrypt"]
    );
    
    // 导出共享密钥为raw格式
    const rawSecret = await window.crypto.subtle.exportKey("raw", sharedSecret);
    
    // 转换为base64字符串
    return btoa(String.fromCharCode(...new Uint8Array(rawSecret)));
}

export async function importAESKey(base64Key: string): Promise<CryptoKey> {
    // 从base64字符串导入AES密钥
    const keyBuffer = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        {
            name: "AES-GCM",
            length: 128, // 128-bit key for AES-GCM
        },
        true,
        ["encrypt", "decrypt"],
    );
}

// 生成12字节的随机nonce用于AES-GCM
export function generateNonce(): Uint8Array {
    return window.crypto.getRandomValues(new Uint8Array(12)); // 12字节nonce
}

// 加密数据使用AES-GCM
export async function encryptAESGCM(data: string, key: CryptoKey): Promise<{ciphertext: string, nonce: string, tag: string}> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    
    // 生成12字节的随机nonce
    const nonce = generateNonce();
    
    // 加密数据
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: nonce as BufferSource,
            tagLength: 128, // 128位认证标签
        },
        key,
        encodedData
    );
    
    // 分离密文和认证标签
    const encryptedArray = new Uint8Array(encrypted);
    const ciphertext = encryptedArray.slice(0, encryptedArray.length - 16); // 最后16字节是标签
    const tag = encryptedArray.slice(encryptedArray.length - 16);
    
    // 转换为base64字符串
    return {
        ciphertext: btoa(String.fromCharCode(...ciphertext)),
        nonce: btoa(String.fromCharCode(...nonce)),
        tag: btoa(String.fromCharCode(...tag))
    };
}

// 解密数据使用AES-GCM
export async function decryptAESGCM(ciphertext: string, nonce: string, tag: string, key: CryptoKey): Promise<string> {
    // 转换base64字符串为Uint8Array
    const ciphertextArray = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const nonceArray = Uint8Array.from(atob(nonce), c => c.charCodeAt(0));
    const tagArray = Uint8Array.from(atob(tag), c => c.charCodeAt(0));
    
    // 合并密文和标签
    const encryptedArray = new Uint8Array(ciphertextArray.length + tagArray.length);
    encryptedArray.set(ciphertextArray);
    encryptedArray.set(tagArray, ciphertextArray.length);
    
    // 解密数据
    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: nonceArray as BufferSource,
            tagLength: 128, // 128位认证标签
        },
        key,
        encryptedArray
    );
    
    // 转换为字符串
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}