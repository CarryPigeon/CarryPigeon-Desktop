export interface SwapKey {
    id: number;
    key: string;
}

export function isReceiveKey(data: any): data is SwapKey{
    return data
        && typeof data.id === "number"
        && typeof data.key === "string";
}