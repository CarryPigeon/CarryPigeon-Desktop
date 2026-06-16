/**
 * @fileoverview Performance API 扩展类型声明
 * @description
 * 扩展标准的 Performance API，添加 Chrome 特有的内存监控接口。
 */

declare global {
  interface Performance {
    /**
     * Chrome 特有的内存信息接口。
     */
    memory?: {
      /**
       * 已分配的 JavaScript 堆内存字节数。
       */
      usedJSHeapSize: number;
      /**
       * 当前 JavaScript 堆内存总量字节数。
       */
      totalJSHeapSize: number;
      /**
       * JavaScript 堆内存大小限制字节数。
       */
      jsHeapSizeLimit: number;
    };
  }

  interface Window {
    /**
     * 手动触发垃圾回收（仅开发环境可用）。
     */
    gc?: () => void;
  }
}

export {};