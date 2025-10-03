import {JSONDict} from "../Data.ts";

export interface SendTextMessage {
    to_id: number,
    text: string,
}

export interface SendTextMessageResponse {
    mid: number,
    cid: number,
}

export interface SendMessage {
    to_id: number,
    domain: string,
    type: number,
    data: JSONDict,
}

export interface SendMessageResponse extends SendTextMessageResponse{}

export interface WithDrawMessage {
    mid: number,
}

export interface WithDrawMessageResponse extends SendTextMessageResponse{}

export interface GetHistoryMessageID {
    from_time: number,
    count: number,
    channel_id: number,
}

export interface GetHistoryMessageIDResponse {
    count: number,
    mids: number[],
}

export interface GetHistoryMessageFromID {
    mids: number[],
}

export interface GetHistoryMessageFromIDResponse {
    messages: MessageStruct[],
}

export interface MessageStruct{
    id: number,
    send_user_id: number,
    to_id: number,
    domain: number,
    type: number,
    data: JSONDict,
    send_time: number,
}

