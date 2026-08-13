/**
 * @fileoverview tauriDbClient 浏览器回退测试
 */

import { describe, expect, it } from "vitest";
import { createDbClient } from "./tauriDbClient";

describe("createDbClient without Tauri", () => {
  it("allows HTTP joint-debug to skip SQLite instead of throwing", async () => {
    const client = createDbClient("server_browser");
    await expect(client.init(undefined, "server")).resolves.toBeUndefined();
    await expect(client.query("select 1", ["x"])).resolves.toEqual({ columns: ["x"], rows: [] });
    await expect(client.execute("insert into x values (1)")).resolves.toEqual({
      rows_affected: 0,
      last_insert_rowid: null,
    });
  });
});
