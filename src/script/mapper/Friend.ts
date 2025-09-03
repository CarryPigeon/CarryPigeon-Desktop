import { integer, text, sqliteTable } from "drizzle-orm/sqlite-core";

export const table = sqliteTable(
    "friend",
    {
        id: integer("id").primaryKey(),
        username: text("username"),
    }
)