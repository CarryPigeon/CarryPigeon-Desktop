import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

export const table = sqliteTable(
    "group",
    {
        id: integer("id").primaryKey(),
        name: text("name").primaryKey(),
        description: text("description"),
        ownerId: integer("owner_id"),
        adminId: text("admin_id"),
        memberId: text("member_id"),
    }
)