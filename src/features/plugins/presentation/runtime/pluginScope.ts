/**
 * @fileoverview plugins｜运行时：PluginScope 轻量作用域内核。
 * @description
 * 借鉴 cordis 的 scope/dispose 思想，为插件运行时提供层级化生命周期管理：
 *
 * - 每个 scope 可注册清理回调（`onDispose`），销毁时按“后注册先执行”的顺序触发；
 * - scope 之间构成树（`parent` / `createChildScope`），父 scope 销毁时递归级联销毁子 scope；
 * - `dispose` 幂等，可安全重复调用；单个回调抛错仅告警，不阻断其余回调；
 * - `runInPluginScope` 提供模块级的“当前 scope”同步绑定，便于宿主在
 *   插件 activate 期间把作用域隐式注入到工厂函数中。
 */

import { createLogger } from "@/shared/utils/logger";

const logger = createLogger("plugin-scope");

/** 清理回调类型（同步执行，抛错会被捕获并告警） */
type DisposeCallback = () => void;

/** PluginScope 实例内部可写字段（对外通过接口收窄为只读） */
interface PluginScopeInternal {
  id: string;
  parent?: PluginScope;
  disposed: boolean;
  children: Set<PluginScope>;
  disposeCallbacks: DisposeCallback[];
  pendingDispose?: Promise<void>;
}

/** 插件作用域：层级化生命周期内核 */
export interface PluginScope {
  /** scope 标识（建议携带 serverId/pluginId 等便于排查） */
  readonly id: string;
  /** 父 scope（根 scope 无父级） */
  readonly parent?: PluginScope;
  /** 是否已销毁 */
  readonly disposed: boolean;
  /** 注册清理回调，返回撤销注册函数 */
  onDispose(cb: DisposeCallback): () => void;
  /** 销毁当前 scope：先递归销毁子 scope，再按后注册先执行触发自身回调；幂等 */
  dispose(): Promise<void>;
  /** 创建子 scope（父 scope 销毁时级联销毁） */
  createChildScope(id: string): PluginScope;
}

/**
 * 模块级“当前 scope”，由 `runInPluginScope` 维护。
 * 说明：仅作同步绑定使用，异步边界后不保证仍有值。
 */
let currentScope: PluginScope | undefined;

/** 导出工厂：创建根 scope */
export function createPluginScope(id: string): PluginScope {
  return createScope(id, undefined);
}

/** 内部构造：创建 scope 实例（根/子共用） */
function createScope(id: string, parent: PluginScope | undefined): PluginScope {
  const internal: PluginScopeInternal = {
    id,
    parent,
    disposed: false,
    children: new Set(),
    disposeCallbacks: [],
  };

  const scope = internal as PluginScopeInternal & PluginScope;

  scope.onDispose = (cb: DisposeCallback): (() => void) => {
    if (internal.disposed) {
      // 已销毁后注册视为无效，直接返回 no-op（不静默执行回调，避免悬挂资源）
      return () => {};
    }
    internal.disposeCallbacks.push(cb);
    let revoked = false;
    return () => {
      if (revoked) return;
      revoked = true;
      const idx = internal.disposeCallbacks.indexOf(cb);
      if (idx >= 0) internal.disposeCallbacks.splice(idx, 1);
    };
  };

  scope.createChildScope = (childId: string): PluginScope => {
    const child = createScope(childId, scope);
    if (internal.disposed) {
      // 父 scope 已销毁：立即销毁新子 scope，保证不产生孤儿存活 scope
      void child.dispose();
      return child;
    }
    internal.children.add(child);
    return child;
  };

  scope.dispose = (): Promise<void> => {
    if (internal.disposed && internal.pendingDispose) {
      // 幂等：重复 dispose 返回同一次销毁 Promise，不产生副作用
      return internal.pendingDispose;
    }
    internal.disposed = true;
    internal.pendingDispose = (async () => {
      // 1) 先递归销毁全部子 scope（子先于父）
      const children = Array.from(internal.children);
      internal.children.clear();
      for (const child of children) {
        await child.dispose();
      }
      // 2) 再触发自身回调：后注册先执行（LIFO）
      const callbacks = internal.disposeCallbacks;
      internal.disposeCallbacks = [];
      while (callbacks.length > 0) {
        const cb = callbacks.pop() as DisposeCallback;
        try {
          cb();
        } catch (err) {
          // 单个回调抛错不阻断后续，仅告警（英文日志含 scope id 与错误信息）
          logger.warn("Action: plugins_scope_dispose_callback_error", {
            scopeId: id,
            error: String(err),
          });
        }
      }
    })();
    return internal.pendingDispose;
  };

  return scope;
}

/**
 * 在指定 scope 内同步执行 fn：执行期间模块级 currentScope 绑定为该 scope。
 * 说明：try/finally 保证异常时也能恢复外层绑定；返回值原样透传。
 */
export function runInPluginScope<T>(scope: PluginScope, fn: () => T): T {
  const prev = currentScope;
  currentScope = scope;
  try {
    return fn();
  } finally {
    currentScope = prev;
  }
}

/** 读取当前绑定的 scope（未绑定时为 undefined），供宿主工厂在 activate 期间获取 */
export function getCurrentPluginScope(): PluginScope | undefined {
  return currentScope;
}
