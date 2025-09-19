import {table} from "../mapper/Channel.ts";
import {database} from "./Init.ts";
import {eq} from "drizzle-orm";

export async function selectAllGroup() {
    return database.select().from(table);
}

export async function insertGroup(groupInfo: any){
    try{
        const info = await database.select().from(table);
        if (info[0].id == groupInfo.groupId){
            console.log("Added it");
        }
    } catch (e) {
        await database.insert(table).values(groupInfo);
    }
}

export async function updateGroup(groupInfo: any) {
    try{
        const info = await database.select().from(table);
        if (info[0].id == groupInfo.groupId){
            await database.update(table).set(groupInfo).where(eq(table.id, groupInfo.id));
        }
    }
    catch (e) {
        console.log(e);
    }
}

export async function deleteGroup(groupId: number) {
    try{
        await database.delete(table).where(eq(table.id, groupId));
    }
    catch (e) {
        console.log(e);
    }
}