export async function generateECCKeyPair(): Promise<{privateKey: CryptoKey, publicKey: string}> {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "ECDSA",
            namedCurve: "P-256",
        },
        true,
        ["sign", "verify"],
    );
    const publicKey = await window.crypto.subtle.exportKey("jwk", keyPair.publicKey)
    const privateKey = keyPair.privateKey;

    const publicKeyBase64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(publicKey))));

    return { privateKey, publicKey: publicKeyBase64 };
}

export async function praseAESKeyPair(base64Key: string): Promise<CryptoKey> {
    const keyBuffer = Uint8Array.from(base64Key);
    return await window.crypto.subtle.importKey(
        "raw",
        keyBuffer,
        {
            name: "AES-CBC",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"],
    );
}