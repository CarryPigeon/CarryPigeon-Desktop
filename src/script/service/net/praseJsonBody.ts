import {
    CommonRequestBody,
    CommonResponseBody,
    isCommonRequestBody,
    isCommonResponseBody
} from "../../struct/CommonRequestBody.ts";
import {isReceiveKey, SwapKey} from "../../struct/SwapKey.ts";

export type JsonBodyType = SwapKey | CommonResponseBody | CommonRequestBody;

function praseJsonToStruct(str: string): JsonBodyType | null {

    try{
        const data = JSON.parse(str);

        if(isReceiveKey(data)) return data;
        if(isCommonRequestBody(data)) return data;
        if(isCommonResponseBody(data)) return data;

        return null;
    } catch(err){
        return null;
    }
}

function pushTask(data:string){
    const result = praseJsonToStruct(data);
    if (result == null) return;
    // TODO: push task
}

export { praseJsonToStruct, pushTask };