// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadFileContent } from "./uploadFileContent";

vi.mock("@/shared/config/runtime", () => ({ USE_MOCK_TRANSPORT: false }));

const origin = "http://127.0.0.1:18080";
const uploadPath = "/api/files/uploads/shr_test";
const success = (data: unknown): Response => Response.json({ code: 0, message: "OK", data });

function uploadAuthorization(hasSame: boolean, url = uploadPath): Response {
  return success({
    file_id: "9001",
    share_key: "shr_test",
    upload: {
      method: "PUT",
      url,
      headers: { "Content-Length": "3" },
      expires_at: 1700000600000,
      has_same: hasSame,
    },
  });
}

function testFile(): File {
  return new File(["abc"], "note.txt", { type: "text/plain" });
}

function mockFetch(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("§11 文件上传", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("申请时发送原始文件的哈希，再用原始文件完成 PUT", async () => {
    const fetchMock = mockFetch(uploadAuthorization(false), success(null));
    const file = testFile();

    await expect(uploadFileContent(origin, "token", file)).resolves.toMatchObject({
      fileId: "9001",
      shareKey: "shr_test",
      upload: { hasSame: false, expiresAt: 1700000600000 },
    });

    const [authorizationUrl, authorization] = fetchMock.mock.calls[0];
    expect(authorizationUrl).toBe(`${origin}/api/files/uploads`);
    expect(authorization?.method).toBe("POST");
    expect(authorization?.headers).toMatchObject({ Authorization: "Bearer token" });
    expect(JSON.parse(String(authorization?.body))).toEqual({
      filename: "note.txt",
      size_bytes: 3,
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, `${origin}${uploadPath}`, {
      method: "PUT",
      headers: { "Content-Type": "text/plain", Authorization: "Bearer token" },
      body: file,
      redirect: "error",
    });
  });

  it("服务端已有相同文件时跳过 PUT", async () => {
    const fetchMock = mockFetch(uploadAuthorization(true));

    await expect(uploadFileContent(origin, "token", testFile())).resolves.toMatchObject({
      shareKey: "shr_test",
      upload: { hasSame: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("保留 HTTP 200 响应中的上传业务错误", async () => {
    mockFetch(uploadAuthorization(false), Response.json({ code: 40007, message: "Upload size mismatch" }));

    await expect(uploadFileContent(origin, "token", testFile())).rejects.toMatchObject({
      status: 200,
      code: 40007,
      message: "Upload size mismatch",
    });
  });

  it("拒绝上传描述符中的跨源目标", async () => {
    const fetchMock = mockFetch(uploadAuthorization(false, "https://example.com/upload"));

    await expect(uploadFileContent(origin, "token", testFile())).rejects.toThrow("Invalid upload.url");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
