import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";

export const table = sqliteTable(
    "GroupMessage",
    {
        groupName: text("groupName").primaryKey(),
        groupId: integer("groupId").primaryKey(),
        fromId: integer("fromId"),
        toId: integer("toId"),
        messageId: integer("messageId").primaryKey(),
        date: text("date"),
        data: text("data"),
        json: text("json"),
        file_path: text("file_path"),
    }
);
