/**
 * @fileoverview TCP API 基类（请求封装 + 响应映射）。
 * @description 提供统一的 `send/sendRequest`，将协议细节收敛在 data 层，避免 UI 直接处理 TCP/JSON 细节。
 */
import { TCP_SERVICE } from "../../features/network/data/tcp";
import { CommandMessage, DataObject } from "./CommandMessage";
import { createLogger } from "../utils/logger";

/**
 * TCP request helper for feature data-layer APIs.
 *
 * Notes:
 * - `send(route, data)` is fire-and-forget.
 * - `send(route, data, mapResponse)` returns a Promise resolved with mapped response.
 * - Prefer mapping responses here to keep parsing logic out of UI.
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
     * Fire-and-forget request (no response handling).
     * Prefer `send()` when you need a response.
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
 * normalizeRoute 方法说明。
 * @param route - 参数说明。
 * @returns 返回值说明。
 */
function normalizeRoute(route: string): string {
    const trimmed = route.trim();
    if (!trimmed) return "/";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * unwrapResponse 方法说明。
 * @param raw - 参数说明。
 * @returns 返回值说明。
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
 * parseMaybeJson 方法说明。
 * @param raw - 参数说明。
 * @returns 返回值说明。
 */
function parseMaybeJson(raw: unknown): unknown {
    if (typeof raw !== "string") return raw;
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return raw;
    }
}
