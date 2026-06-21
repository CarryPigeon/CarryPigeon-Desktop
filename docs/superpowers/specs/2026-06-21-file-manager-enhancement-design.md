# 文件管理功能全面优化设计

## 概述

对 CarryPigeon Desktop 的文件管理功能（`src/features/files/`）进行全面优化，在保持现有 Clean Architecture 架构风格的前提下，增强排序、分页、筛选、批量操作、文件预览、文件删除等能力。

## 现状

当前功能较为基础：
- 文件列表展示（ID、文件名、类型、大小、上传时间、上传者、所属频道）
- 文本搜索（300ms 防抖）
- 类型筛选下拉框（Image / Text / PDF / Archive）
- 单个文件下载（基于 shareKey + Tauri 下载管理）
- 加载骨架屏、空状态、ErrorBoundary

## 优化目标

| 维度 | 目标 |
|------|------|
| **排序** | 按文件名 / 上传时间（默认） / 文件大小，支持升降序切换 |
| **分页** | 无限滚动加载（IntersectionObserver），单次 20 条 |
| **筛选** | 增加上传者筛选、日期范围筛选 |
| **文件预览** | 右侧滑出预览面板，支持图片/视频/音频/PDF 内联预览 |
| **批量操作** | 多选删除（单选删除已在行级） |
| **删除** | 调用服务端 API 真实删除，确认弹窗 |
| **下载反馈** | 下载进度提示 Toast |
| **右键菜单** | 文件行右键菜单（下载、删除、跳转频道、复制链接） |

## 架构设计

### 数据流

```
用户操作
  → FileManagerPage (状态管理)
    → FilesCapabilities (API)
      → composition/fileServices (Port 选择)
        → data/httpFileListPort (HTTP 适配器)
          → 服务端 API

服务端响应
  → data/httpFileListPort → mapFileRecordWire
    → domain/FileRecord
      → presentation (Vue 响应式更新)
```

### 领域层（domain/contracts.ts）

```typescript
export type FileSortField = "filename" | "sizeBytes" | "uploadedAt";
export type SortOrder = "asc" | "desc";

export interface FileListQuery {
  search?: string;
  mimePrefix?: string;
  offset?: number;
  limit?: number;
  sortBy?: FileSortField;
  sortOrder?: SortOrder;
  uploaderId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface FileDeleteRequest {
  fileId: string;
  shareKey: string;
}

export interface BatchFileRequest {
  fileIds: string[];
}

export interface UploaderInfo {
  id: string;
  name: string;
}
```

### Data 层（data/）

**httpFileListPort.ts** — 新增 API 调用：
- `GET /api/files/list` — 扩展参数（sortBy, sortOrder, uploaderId, dateFrom, dateTo）
- `POST /api/files/delete` — `{ shareKey: string }`
- `POST /api/files/batch-delete` — `{ shareKeys: string[] }`
- `GET /api/files/uploaders` — `{ items: { id, name }[] }`

**mockFileListPort.ts** — Mock 数据从 6 条扩展至 20 条，覆盖全类型，实现内存删除模拟。

### Composition 层（composition/fileServices.ts）

新增 Port 类型：
```typescript
export type FileDeletePort = (serverSocket: string, accessToken: string, request: FileDeleteRequest) => Promise<void>;
export type FileBatchDeletePort = (serverSocket: string, accessToken: string, request: BatchFileRequest) => Promise<void>;
export type FileUploadersPort = (serverSocket: string, accessToken: string) => Promise<UploaderInfo[]>;
```

### Capabilities API（api.ts / api-types.ts）

```typescript
export type FilesCapabilities = {
  listFiles(serverSocket: string, accessToken: string, query: FileListQuery): Promise<FileRecord[]>;
  deleteFile(serverSocket: string, accessToken: string, request: FileDeleteRequest): Promise<void>;
  batchDeleteFiles(serverSocket: string, accessToken: string, request: BatchFileRequest): Promise<void>;
  listUploaders(serverSocket: string, accessToken: string): Promise<UploaderInfo[]>;
};
```

## 组件设计

### 组件树

```
FileManagerPage.vue (重构)
  ├── FileSearchBar.vue          ← 增强：上传者/日期筛选
  ├── FileToolbar.vue            ← 新增：排序下拉 + 批量操作栏
  │     ├── SortDropdown
  │     └── BatchActionBar
  ├── FileListTable.vue          ← 增强：排序表头、多选 checkbox、右键菜单
  ├── FilePreviewPanel.vue       ← 新增：右侧滑出预览面板
  ├── DeleteConfirmDialog.vue    ← 新增：删除确认弹窗
  └── DownloadProgressToast.vue  ← 新增：下载进度提示
```

### 交互流程

1. 进入页面 → 加载首批 20 条（uploadedAt desc）
2. 滚动到底 → 自动加载下一页（offset += limit）
3. 切换排序 → 重置列表，按新排序重新加载
4. 搜索/筛选 → 重置列表，按条件重新加载
5. 点击文件 → 打开右侧预览面板
6. 勾选多文件 → 底部批量操作栏出现
7. 点击删除 → 确认弹窗 → API 调用 → 移除列表项
8. 右键文件 → 快捷菜单（下载/删除/跳转频道/复制链接）

### 文件预览策略

| MIME 类型 | 预览方式 |
|-----------|---------|
| `image/*` | `<img>` 缩放显示，自适应 contain |
| `video/*` | `<video>` 播放器（controls） |
| `audio/*` | `<audio>` 播放器（controls） |
| `application/pdf` | `<object>` / iframe 内嵌 |
| 其他 / >50MB | 大号类型图标 + "请下载后查看" |

预览面板为右侧滑入，使用 `<teleport to="body">` 配合过渡动画。

### 删除确认弹窗

```
标题: 确认删除
内容: "确定要删除选中的 N 个文件吗？此操作不可撤销。"
按钮: [取消] [确认删除]
```

删除后状态处理：
- 单行删除 → 从 files 列表中移除
- 批量删除 → 过滤移除所有选中项
- 当前页全部删除 → 自动加载上一页
- 删除失败 → Toast 错误信息

## 状态管理

不引入 Pinia store，在 `FileManagerPage.vue` 中以 `ref` / `reactive` 管理：

```typescript
const files = ref<FileRecord[]>([]);
const loading = ref(false);
const hasMore = ref(true);
const currentQuery = ref<FileListQuery>({ limit: 20 });
const sortField = ref<FileSortField>("uploadedAt");
const sortOrder = ref<SortOrder>("desc");
const selectedIds = ref<Set<string>>(new Set());
const previewFile = ref<FileRecord | null>(null);
const showPreview = ref(false);
const downloadingIds = ref<Set<string>>(new Set());
```

## i18n 新增 key

```
file_sort_filename, file_sort_date, file_sort_size,
file_sort_asc, file_sort_desc,
file_delete_confirm_title, file_delete_confirm_message,
file_delete_success, file_delete_failed,
file_batch_delete, file_selected_count, file_cancel_selection,
file_preview, file_open_channel, file_copy_link, file_link_copied,
file_no_preview, file_size_too_large,
file_uploader_filter, file_date_filter
```

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| 列表加载失败 | ErrorBoundary + 重试按钮 |
| 搜索无结果 | "未找到匹配文件" + 清除筛选建议 |
| 删除失败 | Toast 错误信息 |
| 下载失败 | Toast + 行内错误标记 |
| 预览不支持 | "此格式不支持预览" 提示 |
| 文件过大（>50MB） | "请下载后查看" 提示 |

## 实现阶段规划

### Phase 1 — 基础增强
- 扩展 `domain/contracts.ts`（排序、筛选字段）
- 扩展 `data/` 层（排序参数、上传者列表 API）
- 扩展 mock 数据（20 条、覆盖全类型）
- 扩展 `api.ts` / `api-types.ts`
- 增强 `FileSearchBar.vue`（上传者、日期筛选）
- 新增 `FileToolbar.vue`（排序下拉）
- `FileListTable.vue` 排序表头

### Phase 2 — 分页与批量操作
- `FileListTable.vue` 多选 checkbox
- InfiniteScroll 滚动分页
- 批量操作栏
- `DeleteConfirmDialog.vue`
- 删除 API（data + composition）
- 右键菜单

### Phase 3 — 预览与收尾
- `FilePreviewPanel.vue`（全类型预览）
- `DownloadProgressToast.vue`
- 补全 i18n key
- 集成测试验证
