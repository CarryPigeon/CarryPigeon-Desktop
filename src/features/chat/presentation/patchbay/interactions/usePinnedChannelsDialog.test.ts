/**
 * @fileoverview usePinnedChannelsDialog.test.ts
 * @description 测试置顶频道编辑弹窗编排：打开校验、快照服务器、保存成功/失败分支。
 */

import { describe, expect, it } from "vitest";
import {
  usePinnedChannelsDialog,
  type PinnedChannelsDialogModel,
  type UsePinnedChannelsDialogDeps,
} from "./usePinnedChannelsDialog";

function createDeps(overrides: Partial<UsePinnedChannelsDialogDeps> = {}): UsePinnedChannelsDialogDeps {
  return {
    currentServerSocket: () => "srv",
    currentServerName: () => "Server A",
    pinnedIds: (socket) => (socket === "srv" ? ["c1"] : []),
    setPinnedOrder: async () => {},
    notifySaved: () => {},
    notifySaveFailed: () => {},
    onError: () => {},
    ...overrides,
  };
}

describe("usePinnedChannelsDialog", () => {
  it("opens with the current server snapshot", () => {
    const model: PinnedChannelsDialogModel = usePinnedChannelsDialog(createDeps());

    model.open();

    expect(model.visible).toBe(true);
    expect(model.serverSocket).toBe("srv");
    expect(model.serverName).toBe("Server A");
    expect(model.pinnedIds).toEqual(["c1"]);
  });

  it("refuses to open without an active server and reports the error", () => {
    const errors: unknown[] = [];
    const model = usePinnedChannelsDialog(
      createDeps({
        currentServerSocket: () => "",
        onError: (_action, error) => errors.push(error),
      }),
    );

    model.open();

    expect(model.visible).toBe(false);
    expect(errors).toHaveLength(1);
  });

  it("saves the draft order, notifies and closes on success", async () => {
    const writes: { socket: string; ids: readonly string[] }[] = [];
    let savedCount = 0;
    const model = usePinnedChannelsDialog(
      createDeps({
        setPinnedOrder: async (socket, ids) => {
          writes.push({ socket, ids: [...ids] });
        },
        notifySaved: () => {
          savedCount += 1;
        },
      }),
    );
    model.open();

    await model.handleConfirm(["c2", "c1"]);

    expect(writes).toEqual([{ socket: "srv", ids: ["c2", "c1"] }]);
    expect(savedCount).toBe(1);
    expect(model.visible).toBe(false);
    expect(model.saving).toBe(false);
  });

  it("keeps the dialog open and notifies on failure", async () => {
    const errors: unknown[] = [];
    let failedCount = 0;
    const model = usePinnedChannelsDialog(
      createDeps({
        setPinnedOrder: async () => {
          throw new Error("disk full");
        },
        notifySaveFailed: () => {
          failedCount += 1;
        },
        onError: (_action, error) => errors.push(error),
      }),
    );
    model.open();

    await model.handleConfirm(["c1"]);

    expect(failedCount).toBe(1);
    expect(errors).toHaveLength(1);
    expect(model.visible).toBe(true);
    expect(model.saving).toBe(false);
  });
});
