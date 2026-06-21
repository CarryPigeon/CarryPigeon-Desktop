/**
 * @fileoverview fileAttachmentStore.test.ts
 * @description 测试 fileAttachmentStore：附件添加、移除、分离、状态更新。
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  addFiles,
  removeAttachment,
  clearAttachments,
  detachAttachments,
  detachAttachment,
  updateProgress,
  markDone,
  markError,
  getAttachments,
  getPendingAttachments,
  type FileAttachment,
} from "./fileAttachmentStore";

function makeFile(name: string, mime: string, size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: mime });
}

// Collect blob URLs created during a test for cleanup
const createdBlobUrls: string[] = [];

beforeEach(() => {
  // Spy URL.createObjectURL so we can track / clean up
  vi.spyOn(URL, "createObjectURL").mockImplementation((_blob: Blob | MediaSource) => {
    const url = `blob:mock/${Math.random().toString(36).slice(2)}`;
    createdBlobUrls.push(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((_url: string) => {
    // no-op in mock
  });
});

afterEach(() => {
  // Clear attachments and reset spies
  clearAttachments();
  createdBlobUrls.length = 0;
  vi.restoreAllMocks();
});

describe("addFiles", () => {
  it("should add image files to attachments", () => {
    const file = makeFile("photo.png", "image/png");
    addFiles([file]);
    const all = getAttachments();
    expect(all.size).toBe(1);
    const att = all.values().next().value as FileAttachment;
    expect(att.file.name).toBe("photo.png");
    expect(att.status).toBe("pending");
    expect(att.progress).toBe(0);
    expect(att.id).toMatch(/^att_/);
  });

  it("should add video files to attachments", () => {
    const file = makeFile("clip.mp4", "video/mp4");
    addFiles([file]);
    expect(getAttachments().size).toBe(1);
  });

  it("should skip non-media files (text, application)", () => {
    const textFile = makeFile("notes.txt", "text/plain");
    const jsonFile = makeFile("data.json", "application/json");
    addFiles([textFile, jsonFile]);
    expect(getAttachments().size).toBe(0);
  });

  it("should accept uncommon but valid image/video MIME types", () => {
    const heic = makeFile("img.heic", "image/heic");
    const threeGpp = makeFile("vid.3gp", "video/3gpp");
    addFiles([heic, threeGpp]);
    expect(getAttachments().size).toBe(2);
  });

  it("should accept FileList with multiple mixed files and filter correctly", () => {
    const fileList = [makeFile("a.png", "image/png"), makeFile("b.txt", "text/plain"), makeFile("c.webm", "video/webm")] as unknown as FileList;
    addFiles(fileList);
    expect(getAttachments().size).toBe(2);
  });

  it("should generate unique IDs for each attachment", () => {
    addFiles([makeFile("a.png", "image/png"), makeFile("b.jpg", "image/jpeg")]);
    const all = Array.from(getAttachments().values());
    const ids = all.map((a) => a.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe("removeAttachment", () => {
  it("should remove a single attachment by id", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = getAttachments().values().next().value!.id;
    removeAttachment(id);
    expect(getAttachments().size).toBe(0);
  });

  it("should not throw when removing a non-existent id", () => {
    expect(() => removeAttachment("nonexistent")).not.toThrow();
  });
});

describe("clearAttachments", () => {
  it("should remove all attachments", () => {
    addFiles([makeFile("a.png", "image/png"), makeFile("b.jpg", "image/jpeg")]);
    clearAttachments();
    expect(getAttachments().size).toBe(0);
  });

  it("should be a no-op when already empty", () => {
    expect(() => clearAttachments()).not.toThrow();
    expect(getAttachments().size).toBe(0);
  });
});

describe("detachAttachments", () => {
  it("should clear all attachments without revoking blob URLs", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    // Spy is already set up in beforeEach
    detachAttachments();
    expect(getAttachments().size).toBe(0);
    // revokeObjectURL should NOT have been called during detach
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});

describe("detachAttachment", () => {
  it("should remove a single attachment without revoking its blob URL", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = Array.from(getAttachments().values())[0].id;
    const url = Array.from(getAttachments().values())[0].blobUrl;
    detachAttachment(id);
    expect(getAttachments().size).toBe(0);
    expect(URL.revokeObjectURL).not.toHaveBeenCalledWith(url);
  });

  it("should not throw when detaching a non-existent id", () => {
    expect(() => detachAttachment("nonexistent")).not.toThrow();
  });
});

describe("updateProgress", () => {
  it("should update progress for an existing attachment", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = Array.from(getAttachments().values())[0].id;
    updateProgress(id, 50);
    expect(getAttachments().get(id)?.progress).toBe(50);
  });

  it("should not throw for non-existent id", () => {
    expect(() => updateProgress("nonexistent", 50)).not.toThrow();
  });
});

describe("markDone", () => {
  it("should mark attachment as done with share key", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = Array.from(getAttachments().values())[0].id;
    markDone(id, "sk_test123");
    const att = getAttachments().get(id)!;
    expect(att.status).toBe("done");
    expect(att.progress).toBe(100);
    expect(att.shareKey).toBe("sk_test123");
  });
});

describe("markError", () => {
  it("should mark attachment as error with message", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = Array.from(getAttachments().values())[0].id;
    markError(id, "upload_failed");
    const att = getAttachments().get(id)!;
    expect(att.status).toBe("error");
    expect(att.error).toBe("upload_failed");
  });
});

describe("getPendingAttachments", () => {
  it("should only return pending attachments", () => {
    addFiles([makeFile("a.png", "image/png"), makeFile("b.jpg", "image/jpeg"), makeFile("c.webp", "image/webp")]);
    const all = Array.from(getAttachments().values());
    markDone(all[0].id, "sk_1");
    markError(all[1].id, "err");
    // all[2] is still pending
    const pending = getPendingAttachments();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(all[2].id);
  });

  it("should return empty array when no pending attachments", () => {
    expect(getPendingAttachments()).toEqual([]);
  });
});

describe("getAttachments", () => {
  it("should return a read-only snapshot of attachments", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const map = getAttachments();
    expect(map.size).toBe(1);
  });

  it("should reflect mutations after addition", () => {
    addFiles([makeFile("photo.png", "image/png")]);
    const id = Array.from(getAttachments().values())[0].id;
    markDone(id, "sk_1");
    expect(getAttachments().get(id)?.status).toBe("done");
  });
});

describe("clearAttachments vs detachAttachments — blob URL lifecycle", () => {
  it("clearAttachments should call revokeObjectURL for each attachment", () => {
    addFiles([makeFile("a.png", "image/png"), makeFile("b.jpg", "image/jpeg")]);
    clearAttachments();
    // revoke is called once per attachment
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("detachAttachments should NOT call revokeObjectURL", () => {
    addFiles([makeFile("a.png", "image/png"), makeFile("b.jpg", "image/jpeg")]);
    vi.clearAllMocks();
    detachAttachments();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });
});
