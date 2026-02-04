/**
 * @fileoverview TCP API 基类（请求封装 + 响应映射）。
 * @description 提供统一的 `send/sendRequest`，将协议细节收敛在 data 层，避免 UI 直接处理 TCP/JSON 细节。
 */
import { TCP_SERVICE } from "@/features/network/data/tcp";
import { CommandMessage, DataObject } from "./CommandMessage";
import { createLogger } from "../utils/logger";

/**
 * 用于 feature data-layer 的 TCP 请求辅助基类。
 *
 * 说明：
 * - `send(route, data)` 为 fire-and-forget（不处理响应）。
 * - `send(route, data, mapResponse)` 返回 Promise，并将响应映射为目标类型。
 * - 建议在此处完成响应映射，避免 UI 层处理协议解析细节。
 */
export abstract class BaseAPI {

    private serverSocket: string;
    private readonly logger = createLogger("BaseAPI");
    
    constructor(serverSocket: string) {
        this.serverSocket = serverSocket;
    }

    protected changeChannelSocket(serverSocket: string) {
        this.serverSocket = serverSocket;
    }

    /**
     * 获取当前默认的服务端 socket。
     * @returns 当前服务端 socket 字符串
     */
    public getChannelSocket(): string {
        return this.serverSocket;
    }

    /**
     * 发送 fire-and-forget 请求（不处理响应）。
     *
     * 建议：需要响应时优先使用 `send()`（带 mapResponse）。
     */
    protected async sendRequest(route: string, data?: DataObject | undefined, callback?: () => unknown) {
        return this.sendRequestTo(this.serverSocket, route, data, callback);
    }

    protected async sendRequestTo(serverSocket: string, route: string, data?: DataObject | undefined, callback?: () => unknown) {
        const normalizedRoute = normalizeRoute(route);
        const context: CommandMessage = {
            route: normalizedRoute,
            data
        };
        const service = TCP_SERVICE.get(serverSocket);
        if (!service) {
            this.logger.error("TcpService not found", { serverSocket, route });
            return;
        }

        await service.send(serverSocket, JSON.stringify(context));
        if (callback) return callback();
    }
    
    protected send(route: string, data?: DataObject | undefined): Promise<void>;
    protected send<T>(route: string, data: DataObject | undefined, mapResponse: (data: unknown) => T): Promise<T>;
    protected async send<T>(route: string, data?: DataObject | undefined, mapResponse?: (data: unknown) => T): Promise<void | T> {
        if (mapResponse) return this.sendTo(this.serverSocket, route, data, mapResponse);
        return this.sendTo(this.serverSocket, route, data);
    }

    protected sendTo(serverSocket: string, route: string, data?: DataObject | undefined): Promise<void>;
    protected sendTo<T>(serverSocket: string, route: string, data: DataObject | undefined, mapResponse: (data: unknown) => T): Promise<T>;
    protected async sendTo<T>(
        serverSocket: string,
        route: string,
        data?: DataObject | undefined,
        mapResponse?: (data: unknown) => T,
    ): Promise<void | T> {
        const normalizedRoute = normalizeRoute(route);
        const context: CommandMessage = {
            route: normalizedRoute,
            data
        };
        const service = TCP_SERVICE.get(serverSocket);
        if (!service) {
            this.logger.error("TcpService not found", { serverSocket, route });
            return;
        }

        if (!mapResponse) {
            await service.send(serverSocket, JSON.stringify(context));
            return;
        }

        return new Promise<T>((resolve, reject) => {
            void service
                .sendWithResponse(serverSocket, JSON.stringify(context), (raw) => {
                    try {
                        const { code, data: responseData } = unwrapResponse(raw);
                        if (code !== undefined && code !== 200) {
                            this.handleError(code);
                            reject(new Error(`Request failed with code ${code}`));
                            return;
                        }
                        resolve(mapResponse(responseData));
                    } catch (e) {
                        this.logger.error("Response mapping failed", { serverSocket, route, error: String(e) });
                        reject(e);
                    }
                })
                .catch((e) => {
                    this.logger.error("sendWithResponse failed", { serverSocket, route, error: String(e) });
                    reject(e);
                });
        });
    }
    
    protected handleError(code: number): void {
        switch (code) {
            case 100:
                // TODO(UX): 统一弹窗提示失败
                this.logger.error("Operation failed", { code });
                break;
            case 200:
                // 成功，无需处理
                break;
            case 300:
                // TODO(UX): 统一弹窗提示权限校验失败
                this.logger.error("Permission denied", { code });
                break;
            default:
                this.logger.error("Unknown error code", { code });
        }
    }
}

/**
 * 将路由字符串归一化为稳定的“前导斜杠”形式。
 *
 * 示例：
 * - `"chat/send"` → `"/chat/send"`
 * - `"/chat/send"` → `"/chat/send"`
 * - `""` → `"/"`
 *
 * @param route - 原始路由字符串。
 * @returns 归一化后的路由。
 */
function normalizeRoute(route: string): string {
    const trimmed = route.trim();
    if (!trimmed) return "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * 从 TCP 回调返回值中解包响应载荷。
 *
 * 原生侧（Rust/native）可能返回：
 * - 包含 `{ code, data }` 的 JSON 字符串
 * - 直接返回原始 JSON 字符串/对象（视作响应 `data`）
 *
 * @param raw - transport 回调返回的原始值。
 * @returns 归一化后的 `{ code?, data? }`。
 */
function unwrapResponse(raw: unknown): { code?: number; data?: unknown } {
    const value = parseMaybeJson(raw);
    if (value && typeof value === "object" && "code" in value) {
        const payload = value as Record<string, unknown>;
        const code = typeof payload.code === "number" ? payload.code : Number(payload.code);
        return { code: Number.isFinite(code) ? code : undefined, data: payload.data };
    }
    return { data: value };
}

/**
 * 尝试将字符串解析为 JSON；失败则原样返回。
 *
 * @param raw - 原始值（string/object 等）。
 * @returns 当 `raw` 为 JSON 字符串时返回解析后的值；否则返回原值。
 */
function parseMaybeJson(raw: unknown): unknown {
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return raw;
    }
}
