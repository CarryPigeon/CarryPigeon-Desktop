import {database} from "./Init.ts";
import {table} from "../mapper/ChannelMessage.ts";
import {between, eq} from "drizzle-orm";

export async function selectAllLocalMessagesData(groupId: number) {
    return database.select().from(table).where(eq(table.groupId, groupId));
}

export async function selectOneLocalMessageData(groupId: number, messageId: number) {
    return database.select().from(table).where(eq(table.groupId, groupId) && eq(table.messageId, messageId));
}

export async function selectRangeLocalMessageData(groupId: number, start: number, end: number) {
    return database.select().from(table).where(eq(table.groupId, groupId) && between(table.messageId, start, end));
}

export async function insertLocalMessageData(data: any) {
    try {
        await database.insert(table).values(data);
    } catch (e) {
        console.log(e);
    }
}

export async function deleteLocalMessageData(groupId: number, messageId:number) {
    await database.delete(table).where(eq(table.groupId, groupId) && eq(table.messageId, messageId));
}

export async function updateLocalMessageData(data: any) {
    try {
        await database.update(table).set(data).where(eq(table.messageId, data.messageId));
    } catch (e) {
        console.log(e);
    }
}