import {unescape} from "querystring";

export async function generateECCKeyPair(): Promise<{privateKey: CryptoKey, publicKey: string}> {
    let keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"],
    );
    let publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey)
    let privateKey = keyPair.privateKey;

    let publicKeyBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(publicKey))));

    return { privateKey, publicKey: publicKeyBase64 };
}

export async function praseAESKeyPair(base64Key: string): Promise<CryptoKey> {
    const keyBuffer = Uint8Array.from(base64Key);
    const key = await window.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        {
            name: "AES-CBC",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"],
    );
    return key;
}

