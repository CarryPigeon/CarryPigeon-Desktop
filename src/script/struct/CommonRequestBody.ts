import {JSONDict} from "./Data.ts";

export interface CommonRequestBody {
    id: number,
    route: string,
    data: JSONDict,
}

export interface CommonResponseBody {
    id: number,
    code: number,
    data: JSONDict,
}

export function isCommonRequestBody(data: any) : data is CommonRequestBody{
    return data
    && typeof data.id === "number"
    && typeof data.route === "string";
}

export function isCommonResponseBody(data: any) : data is CommonResponseBody{
    return data
    && typeof data.id === "number"
    && typeof data.code === "string";
}