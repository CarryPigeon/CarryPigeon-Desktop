# 性能测试基准和监控

## 当前性能状态

### 已实现的性能优化
- ✅ 聊天消息虚拟滚动（ba30665 commit）
- ✅ 启动性能优化（3323d41 commit）
- ✅ 前端构建优化配置（手动分块、依赖预优化）
- ✅ 图片懒加载（基于 Intersection Observer，支持占位符、重试、加载状态反馈）
- ✅ WebSocket 连接池（连接复用、LRU 驱逐、闲置清理、参考计数、预热）
- ✅ 内存监控（定时采样、趋势分析、阈值告警、自动清理回调、全局单例）

### 性能测试基准

#### 启动性能
- **目标**: 应用启动时间 < 3秒
- **当前状态**: 已有基础优化，需要进一步测试
- **测试方法**: 从点击应用到主界面完全加载

#### 渲染性能
- **目标**: 消息列表滚动帧率 > 60fps
- **当前状态**: 虚拟滚动已实现，图片懒加载减少渲染阻塞
- **测试方法**: 滚动包含 1000+ 消息的聊天记录

#### 内存使用
- **目标**: 空闲内存 < 200MB，稳定运行无泄漏
- **当前状态**: 内存监控已集成，自动记录内存趋势并触发告警
- **测试方法**: 长时间运行监控内存增长（可通过内存监控日志查看）

#### 网络性能
- **目标**: WebSocket 消息延迟 < 100ms
- **当前状态**: 连接池已集成，减少重复连接开销
- **测试方法**: 监控消息发送到接收的时间差

## 性能优化架构

### 图片懒加载（`ImageMessageBubble.vue`）
- 使用 `IntersectionObserver` 监测视口可见性（`rootMargin: 100px`, `threshold: 0.01`）
- 加载状态机：`pending → loading → loaded | error`
- 加载失败自动重试（最多 3 次，指数退避 500ms × retryCount）
- 点击缩略图触发 `openLightbox` 事件

### WebSocket 连接池（`wsConnectionPool.ts`）
- 全局单例 `getWsConnectionPool()`，最大连接数 5
- LRU 驱逐策略，闲置 10 分钟或生命周期超 30 分钟自动清理
- 参考计数管理：`registerConnection` / `unregisterConnection`
- 集成到 `connectChatWs`：连接创建时自动注册，关闭时自动注销

### 内存监控（`memoryMonitor.ts`）
- 全局单例 `getMemoryMonitor()`，5 秒采样间隔
- 警告阈值 70%，危急阈值 90%（触发自动清理）
- 趋势分析：增长 / 稳定 / 下降，含增长率计算
- 注册清理回调机制，支持手动触发 GC

### 交互性能工程化（Phase 2）
- 搜索输入统一使用 `rateLimit.debounce` / `debounceAsync`（ContactsPage、DomainCatalogPage、SearchPanel、ForwardChannelDialog）。
- chat 刷新函数（`refreshChannels`、`refreshChannelLatestPage`、`refreshMembersRail`）使用 `asyncDedupe` 去重。
- 消息排序引入 Web Worker 自适应：合并后消息数 > 2000 时 offload 到 Worker，小数据量 fallback 主线程。

### 构建性能
| 指标 | 优化前 | 当前 |
|------|--------|------|
| 模块数 | — | 4,467 |
| typecheck 耗时 | — | **13.1s** |
| build 耗时（含 typecheck） | — | **16.5s** |
| Rust tests 耗时 | — | **39.2s** |
| 首页入口 (index) | — | **121.16 kB** (gzip ~36 kB) |
| MainPage 包 | **434.95 kB** (gzip ~101 kB) | **222.26 kB** (gzip ~68 kB) **(-49%)** |
| vendor-vue | — | **80.80 kB** (gzip ~28 kB) |
| vendor-tdesign | — | **384.97 kB** (gzip ~127 kB) |
| ImageLightbox | 内联 MainPage | **3.48 kB** (gzip ~1.6 kB) 懒加载 |
| 分块策略 | 默认 | 手动分块 + 依赖预优化 + 内联动态导入 |

## 性能监控工具

### Rust 端监控
```bash
# 使用 tracing 日志监控性能
export RUST_LOG=info,carrypigeon_desktop_lib=debug
```

### 前端性能监控
```javascript
// 使用 Performance API 监控渲染性能（仅在 dev 或诊断模式下启用）
const perfData = window.performance.timing;
const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
console.log('Page load time:', pageLoadTime);
```

### 性能监控分级（release 行为）
- **release 默认**：不启动内存监控、不记录启动耗时、不输出性能监控日志；仅保留 ERROR 级别错误日志。
- **诊断模式**：在设置 → 运行时中开启，手动启用 dev 级性能监控（内存采样、启动耗时、性能日志）。
- **统一开关**：所有性能监控逻辑通过 `isPerformanceMonitoringEnabled()` 判断，入口位于 `src/shared/config/performance.ts`。

### 内存监控日志（`memory_monitor` scope）
可在应用日志中搜索 `Action: memory_*` 查看内存状态：
```
Action: memory_monitor_started
Action: memory_usage_normal      { usedPercentage, usedJSHeapSize }
Action: memory_usage_warning     { usedPercentage, usedJSHeapSize }
Action: memory_usage_critical    { usedPercentage, usedJSHeapSize }
Action: memory_cleanup_completed { duration }
```

### WebSocket 连接池日志（`ws_connection_pool` scope）
```
Action: ws_pool_connection_registered  { socket, poolSize }
Action: ws_pool_connection_unregistered { socket, poolSize }
Action: ws_pool_connection_reused      { socket, refCount }
Action: ws_pool_cleanup                { cleaned, sockets }
Action: ws_pool_evict_lru              { socket, lastActiveAt }
```

### Chrome DevTools
- Performance 面板分析渲染性能
- Memory 面板检查内存泄漏
- Network 面板分析网络请求

## 性能优化检查清单

### 前端优化
- [x] Vite 构建优化配置（手动分块、依赖预优化）
- [x] 虚拟滚动（消息列表 + ThreadPanel）
- [x] 虚拟滚动 estimateSize 精度优化（按消息类型区分高度）
- [x] 图片懒加载（Intersection Observer + 重试退避）
- [x] 前端内存监控（定时采样 + 趋势分析 + 阈值告警）
- [x] 路由懒加载（全部路由内联动态导入，MainPage 435KB→222KB）
- [x] 组件懒加载（ImageLightbox defineAsyncComponent）
- [x] 防抖/节流工具（rateLimit.ts，已应用于 ContactsPage、DomainCatalogPage、SearchPanel、ForwardChannelDialog、FileSearchBar）
- [x] Web Worker（消息排序自适应 Worker 化：大数据量 offload 到 Worker，小数据量 fallback 主线程）

### 后端优化
- [x] WebSocket 连接池（连接复用 + LRU 驱逐 + 闲置清理）
- [x] SQLite PRAGMA 优化（WAL 模式 + NORMAL sync + 8MB cache + busy_timeout）
- [x] DB 关闭时的 WAL checkpoint + 文件重试删除（解决 Windows 文件锁）
- [ ] 异步任务处理（可通过内存监控清理回调扩展）
- [ ] 内存缓存策略（内存监控的清理回调可扩展）
- [ ] 文件 IO 优化

### 网络优化
- 桌面应用场景，大部分优化不适用（HTTP/2、CDN、Gzip 等由服务端控制）
- [x] 请求去重（asyncDedupe 已应用于 refreshChannels、refreshChannelLatestPage、refreshMembersRail）

## 性能测试与基础设施

### 基准测试
```bash
# 全流程基准（build + typecheck + cargo check + cargo test）
# 结果写入 docs/performance-benchmarks/data/latest.json，并与 baseline.json 做回归检测。
pnpm benchmark

# 手动对比当前结果与基线
node scripts/benchmark-compare.mjs

# 前端构建时间测试
time pnpm run build

# Rust 测试
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
```

### 回归阈值
| 指标 | 阈值（相对 baseline） |
|------|----------------------|
| build_time_ms | +20% |
| typecheck_time_ms | +20% |
| cargo_check_time_ms | +20% |
| cargo_test_time_ms | +20% |
| main_js_bytes | +5% |
| all_js_bytes | +5% |

超过阈值时 `scripts/benchmark-compare.mjs` 返回退出码 2。

### 前端测试基础设施
```bash
# 运行单元测试（jsdom 环境）
pnpm test

# 观察模式
pnpm test:watch
```

### 内存泄漏测试
```javascript
// 获取内存监控统计信息
const { getMemoryMonitor } = await import('@/shared/monitoring/memoryMonitor');
const monitor = getMemoryMonitor();
const stats = monitor.getStats();
const trend = monitor.getTrendAnalysis();
console.log('Memory stats:', stats);
console.log('Memory trend:', trend);
```

## 性能问题诊断流程

1. **用户反馈性能问题**
2. **复现问题场景**
3. **收集性能数据**（DevTools、日志中 `Action: memory_*` / `ws_pool_*`）
4. **分析瓶颈点**（CPU、内存、网络、IO）
5. **针对性优化**
6. **验证优化效果**
7. **回归测试**

## 下一步行动

1. ~~实施图片懒加载~~ ✅ 已完成
2. ~~优化 WebSocket 连接管理~~ ✅ 已完成（连接池已集成）
3. ~~添加性能监控日志~~ ✅ 已完成（内存监控 + WS 连接池日志）
4. ~~建立性能测试自动化（集成 CI 性能回归检测）~~ ✅ 已完成（`scripts/perf-benchmark.sh` + `scripts/benchmark-compare.mjs`）
5. ~~release 默认关闭性能监控，提供诊断模式开关~~ ✅ 已完成
6. 定期性能回归测试
7. 系统化防抖/节流检查
8. 探索 Web Worker 处理序列化/加密等繁重计算
