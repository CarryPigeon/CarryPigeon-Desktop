import { table } from "../mapper/Friend.ts";
import { database } from "./Init.ts";
import { eq } from "drizzle-orm";

export async function selectAllFriend() {
    return database.select({
        id: table.id,
        username: table.username,
    }).from(table);
}

export async function selectOneDetailInfo(userId: number) {
    const result = await database.select().from(table).where(eq(table.id, userId));
    return result[0];
}