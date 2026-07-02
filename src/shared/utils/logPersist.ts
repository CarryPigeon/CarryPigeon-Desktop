/**
 * @fileoverview 前端日志持久化到 Tauri app data 目录。
 */
import { createLogger, type Logger } from './logger';
import { TAURI_COMMANDS } from "@/shared/tauri/commands";

const logger = createLogger('logPersist');

let logBuffer: string[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 将日志行写入持久化文件。
 */
async function flushBuffer(): Promise<void> {
  if (logBuffer.length === 0) return;
  const lines = logBuffer.splice(0);
  const content = lines.join('\n') + '\n';
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke(TAURI_COMMANDS.writeAppLog, { content });
  } catch {
    // 写入失败时静默处理，避免循环日志
  }
}

/**
 * 将一条日志追加到内存缓冲区，定期刷盘。
 */
function appendToBuffer(line: string): void {
  logBuffer.push(line);
  if (logBuffer.length >= 50) {
    void flushBuffer();
  }
}

/**
 * 创建带文件持久化的 Logger 包装。
 */
export function createPersistentLogger(scope: string): Logger {
  const base = createLogger(scope);

  function persistAndCall(
    method: (message: string, meta?: Record<string, unknown>) => void,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    method(message, meta);
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    appendToBuffer(`[${new Date().toISOString()}] [${scope}] ${message}${metaStr}`);
  }

  return {
    debug(message, meta) { persistAndCall(base.debug, message, meta); },
    info(message, meta) { persistAndCall(base.info, message, meta); },
    warn(message, meta) { persistAndCall(base.warn, message, meta); },
    error(message, meta) { persistAndCall(base.error, message, meta); },
  };
}

/**
 * 启动日志持久化定时器。
 */
export function startLogPersistence(): void {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    void flushBuffer();
  }, 5000);
  logger.info('Action: api_log_persist_started');
}

/**
 * 停止日志持久化定时器。
 */
export function stopLogPersistence(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  void flushBuffer();
}
