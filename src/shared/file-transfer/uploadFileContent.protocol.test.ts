// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { HttpJsonClient } from "@/shared/net/http/httpJsonClient";
import { uploadFileContent } from "./uploadFileContent";

vi.mock("@/shared/config/runtime", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/shared/config/runtime")>(),
  USE_MOCK_TRANSPORT: true,
}));

describe("文件上传协议模拟", () => {
  it("只有写入文件后，再次授权同一摘要才命中去重", async () => {
    const serverSocket = "mock://upload-contract";
    const client = new HttpJsonClient({ serverSocket, apiVersion: 1 });
    const credentials = { username: "upload-test", password: "mock-password" };
    const email = "upload@example.test";
    await client.requestJson("POST", "/auth/email_codes", { email, purpose: "REGISTER" });
    await client.requestJson("POST", "/auth/register", { ...credentials, email, code: "123456" });
    const { access_token: accessToken } = await client.requestJson<{ access_token: string }>(
      "POST", "/auth/login/pwd", credentials,
    );
    const file = new File(["abc"], "note.txt", { type: "text/plain" });

    const first = await uploadFileContent(serverSocket, accessToken, file);
    expect(first.upload.hasSame).toBe(false);
    const second = await uploadFileContent(serverSocket, accessToken, file);
    expect(second.upload.hasSame).toBe(true);
    expect(second.fileId).toBe(first.fileId);
  });
});
