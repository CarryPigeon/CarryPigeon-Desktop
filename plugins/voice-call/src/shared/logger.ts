// 插件本地日志：日志统一英文输出（全局约束：日志英文）。
type LogPayload = Record<string, unknown>;

type Logger = {
  debug: (message: string, payload?: LogPayload) => void;
  info: (message: string, payload?: LogPayload) => void;
  warn: (message: string, payload?: LogPayload) => void;
  error: (message: string, payload?: LogPayload) => void;
};

export function createLogger(name: string): Logger {
  const prefix = `[voice-call:${name}]`;
  return {
    debug: (message, payload) => console.debug(prefix, message, payload ?? ""),
    info: (message, payload) => console.info(prefix, message, payload ?? ""),
    warn: (message, payload) => console.warn(prefix, message, payload ?? ""),
    error: (message, payload) => console.error(prefix, message, payload ?? ""),
  };
}
