/**
 * @fileoverview 内存监控管理器
 * @description
 * 提供应用内存使用监控、内存泄漏检测和自动清理机制。
 */

import { createLogger } from "@/shared/utils/logger";
import { isPerformanceMonitoringEnabled } from "@/shared/config/performance";

const logger = createLogger("memory_monitor");

/**
 * 内存使用快照。
 */
type MemorySnapshot = {
  timestamp: number;
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usedPercentage: number;
};

/**
 * 内存监控配置。
 */
type MemoryMonitorConfig = {
  /**
   * 监控采样间隔（毫秒）。
   */
  sampleIntervalMs: number;
  /**
   * 内存使用警告阈值（百分比，0-100）。
   */
  warningThreshold: number;
  /**
   * 内存使用危急阈值（百分比，0-100）。
   */
  criticalThreshold: number;
  /**
   * 是否启用自动内存清理。
   */
  enableAutoCleanup: boolean;
  /**
   * 保留的历史快照数量。
   */
  historySize: number;
};

/**
 * 默认配置。
 */
const DEFAULT_CONFIG: MemoryMonitorConfig = {
  sampleIntervalMs: 5000, // 5秒采样一次
  warningThreshold: 70, // 70%
  criticalThreshold: 90, // 90%
  enableAutoCleanup: true,
  historySize: 100, // 保留最近100个快照
};

/**
 * 内存清理回调类型。
 */
type MemoryCleanupCallback = () => void | Promise<void>;

/**
 * 内存状态变化回调类型。
 */
type MemoryStatusCallback = (snapshot: MemorySnapshot, status: 'normal' | 'warning' | 'critical') => void;

/**
 * 内存监控管理器。
 */
export class MemoryMonitor {
  private config: MemoryMonitorConfig;
  private history: MemorySnapshot[] = [];
  private timer: number | null = null;
  private isRunning = false;
  private cleanupCallbacks: Set<MemoryCleanupCallback> = new Set();
  private statusCallbacks: Set<MemoryStatusCallback> = new Set();
  private lastSnapshot: MemorySnapshot | null = null;

  constructor(config: Partial<MemoryMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (isPerformanceMonitoringEnabled()) {
      logger.info("Action: network_memory_monitor_initialized", {
        sampleIntervalMs: this.config.sampleIntervalMs,
        warningThreshold: this.config.warningThreshold,
        criticalThreshold: this.config.criticalThreshold,
      });
    }
  }

  /**
   * 获取当前内存使用情况。
   */
  private getMemorySnapshot(): MemorySnapshot | null {
    if (!performance || !performance.memory) {
      logger.warn("Action: network_memory_api_not_available");
      return null;
    }

    const mem = performance.memory;
    const now = Date.now();

    const snapshot: MemorySnapshot = {
      timestamp: now,
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
      jsHeapSizeLimit: mem.jsHeapSizeLimit,
      usedPercentage: (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100,
    };

    return snapshot;
  }

  /**
   * 判断内存状态。
   */
  private getMemoryStatus(snapshot: MemorySnapshot): 'normal' | 'warning' | 'critical' {
    if (snapshot.usedPercentage >= this.config.criticalThreshold) {
      return 'critical';
    } else if (snapshot.usedPercentage >= this.config.warningThreshold) {
      return 'warning';
    }
    return 'normal';
  }

  /**
   * 执行内存清理。
   */
  private async performCleanup(): Promise<void> {
    logger.info("Action: network_memory_cleanup_started");
    const startTime = Date.now();

    try {
      // 调用所有注册的清理回调
      const cleanupPromises = Array.from(this.cleanupCallbacks).map(callback => {
        try {
          return Promise.resolve(callback());
        } catch (error) {
          logger.error("Action: network_memory_cleanup_callback_failed", { error: String(error) });
          return Promise.resolve();
        }
      });

      await Promise.all(cleanupPromises);

      // 强制垃圾回收（仅开发环境可用）
      if (typeof (window as any).gc === 'function') {
        try {
          (window as any).gc();
          logger.debug("Action: network_memory_gc_triggered");
        } catch (error) {
          logger.debug("Action: network_memory_gc_not_available");
        }
      }

      // 触发内存清理后重新采样
      setTimeout(() => {
        this.sample();
      }, 1000);

      const duration = Date.now() - startTime;
      logger.info("Action: network_memory_cleanup_completed", { duration });
    } catch (error) {
      logger.error("Action: network_memory_cleanup_failed", { error: String(error) });
    }
  }

  /**
   * 采样内存使用情况。
   */
  private sample(): void {
    const snapshot = this.getMemorySnapshot();
    if (!snapshot) {
      return;
    }

    this.lastSnapshot = snapshot;

    // 添加到历史记录
    this.history.push(snapshot);
    if (this.history.length > this.config.historySize) {
      this.history.shift();
    }

    // 判断状态并触发回调
    const status = this.getMemoryStatus(snapshot);
    this.statusCallbacks.forEach(callback => {
      try {
        callback(snapshot, status);
      } catch (error) {
        logger.error("Action: network_memory_status_callback_failed", { error: String(error) });
      }
    });

    // 根据状态执行相应操作
    if (status === 'critical') {
      logger.error("Action: network_memory_usage_critical", {
        usedPercentage: snapshot.usedPercentage.toFixed(2),
        usedJSHeapSize: this.formatBytes(snapshot.usedJSHeapSize),
        jsHeapSizeLimit: this.formatBytes(snapshot.jsHeapSizeLimit),
      });

      if (this.config.enableAutoCleanup) {
        this.performCleanup();
      }
    } else if (status === 'warning') {
      logger.warn("Action: network_memory_usage_warning", {
        usedPercentage: snapshot.usedPercentage.toFixed(2),
        usedJSHeapSize: this.formatBytes(snapshot.usedJSHeapSize),
        jsHeapSizeLimit: this.formatBytes(snapshot.jsHeapSizeLimit),
      });
    } else {
      logger.debug("Action: network_memory_usage_normal", {
        usedPercentage: snapshot.usedPercentage.toFixed(2),
        usedJSHeapSize: this.formatBytes(snapshot.usedJSHeapSize),
      });
    }
  }

  /**
   * 格式化字节数。
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * 启动内存监控。
   */
  start(): void {
    if (!isPerformanceMonitoringEnabled()) {
      return;
    }

    if (this.isRunning) {
      logger.warn("Action: network_memory_monitor_already_running");
      return;
    }

    this.isRunning = true;
    logger.info("Action: network_memory_monitor_started");

    // 立即采样一次
    this.sample();

    // 启动定时采样
    this.timer = window.setInterval(() => {
      this.sample();
    }, this.config.sampleIntervalMs);
  }

  /**
   * 停止内存监控。
   */
  stop(): void {
    if (!isPerformanceMonitoringEnabled()) {
      return;
    }

    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info("Action: network_memory_monitor_stopped");
  }

  /**
   * 注册内存清理回调。
   */
  registerCleanupCallback(callback: MemoryCleanupCallback): () => void {
    if (!isPerformanceMonitoringEnabled()) {
      return () => {};
    }

    this.cleanupCallbacks.add(callback);
    logger.debug("Action: network_memory_cleanup_callback_registered", {
      totalCallbacks: this.cleanupCallbacks.size,
    });

    // 返回取消注册函数
    return () => {
      this.cleanupCallbacks.delete(callback);
      logger.debug("Action: network_memory_cleanup_callback_unregistered", {
        totalCallbacks: this.cleanupCallbacks.size,
      });
    };
  }

  /**
   * 注册内存状态变化回调。
   */
  registerStatusCallback(callback: MemoryStatusCallback): () => void {
    if (!isPerformanceMonitoringEnabled()) {
      return () => {};
    }

    this.statusCallbacks.add(callback);
    logger.debug("Action: network_memory_status_callback_registered", {
      totalCallbacks: this.statusCallbacks.size,
    });

    // 返回取消注册函数
    return () => {
      this.statusCallbacks.delete(callback);
      logger.debug("Action: network_memory_status_callback_unregistered", {
        totalCallbacks: this.statusCallbacks.size,
      });
    };
  }

  /**
   * 手动触发内存清理。
   */
  async triggerCleanup(): Promise<void> {
    if (!isPerformanceMonitoringEnabled()) {
      return;
    }

    logger.info("Action: network_memory_cleanup_manually_triggered");
    await this.performCleanup();
  }

  /**
   * 获取最新快照。
   */
  getLatestSnapshot(): MemorySnapshot | null {
    return this.lastSnapshot;
  }

  /**
   * 获取历史快照。
   */
  getHistory(): MemorySnapshot[] {
    return [...this.history];
  }

  /**
   * 获取统计信息。
   */
  getStats(): {
    isRunning: boolean;
    snapshotCount: number;
    latestSnapshot: MemorySnapshot | null;
    cleanupCallbacksCount: number;
    statusCallbacksCount: number;
  } {
    return {
      isRunning: this.isRunning,
      snapshotCount: this.history.length,
      latestSnapshot: this.lastSnapshot,
      cleanupCallbacksCount: this.cleanupCallbacks.size,
      statusCallbacksCount: this.statusCallbacks.size,
    };
  }

  /**
   * 获取内存趋势分析。
   */
  getTrendAnalysis(): {
    trend: 'increasing' | 'decreasing' | 'stable';
    averageUsage: number;
    maxUsage: number;
    minUsage: number;
    growthRate: number; // 每分钟增长率
  } | null {
    if (this.history.length < 2) {
      return null;
    }

    const recentSnapshots = this.history.slice(-20); // 取最近20个样本
    const usages = recentSnapshots.map(s => s.usedPercentage);

    const averageUsage = usages.reduce((a, b) => a + b, 0) / usages.length;
    const maxUsage = Math.max(...usages);
    const minUsage = Math.min(...usages);

    // 计算趋势
    const firstUsage = usages[0];
    const lastUsage = usages[usages.length - 1];
    const diff = lastUsage - firstUsage;

    let trend: 'increasing' | 'decreasing' | 'stable';
    if (diff > 5) {
      trend = 'increasing';
    } else if (diff < -5) {
      trend = 'decreasing';
    } else {
      trend = 'stable';
    }

    // 计算每分钟增长率
    const timeSpanMs = recentSnapshots[recentSnapshots.length - 1].timestamp - recentSnapshots[0].timestamp;
    const timeSpanMinutes = timeSpanMs / (60 * 1000);
    const growthRate = timeSpanMinutes > 0 ? (diff / timeSpanMinutes) : 0;

    return {
      trend,
      averageUsage,
      maxUsage,
      minUsage,
      growthRate,
    };
  }

  /**
   * 清空历史记录。
   */
  clearHistory(): void {
    this.history = [];
    this.lastSnapshot = null;
    if (isPerformanceMonitoringEnabled()) {
      logger.info("Action: network_memory_history_cleared");
    }
  }

  /**
   * 销毁监控器。
   */
  destroy(): void {
    this.stop();
    this.cleanupCallbacks.clear();
    this.statusCallbacks.clear();
    this.clearHistory();
    if (isPerformanceMonitoringEnabled()) {
      logger.info("Action: network_memory_monitor_destroyed");
    }
  }
}

/**
 * 全局内存监控实例。
 */
let globalMemoryMonitor: MemoryMonitor | null = null;

/**
 * 获取全局内存监控实例。
 *
 * @param config - 可选配置（仅首次调用时生效）
 */
export function getMemoryMonitor(config?: Partial<MemoryMonitorConfig>): MemoryMonitor {
  if (!globalMemoryMonitor) {
    globalMemoryMonitor = new MemoryMonitor(config);
  }
  return globalMemoryMonitor;
}

/**
 * 销毁全局内存监控实例。
 */
export function destroyMemoryMonitor(): void {
  if (globalMemoryMonitor) {
    globalMemoryMonitor.destroy();
    globalMemoryMonitor = null;
  }
}