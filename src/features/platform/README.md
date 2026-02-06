# platform（平台能力封装）

## 定位

platform 负责把“桌面端平台能力”抽象为可测试、可替换的 domain ports，并通过 data 层的 Tauri 适配器落地。其目标是让业务与 UI 不直接依赖平台 API（Tauri），从而降低耦合、提升可维护性。

## 职责边界

做什么：

- 定义平台能力端口（例如窗口管理、打开信息窗口/弹窗、调整窗口尺寸）。
- 提供平台用例（usecases），把“平台操作”封装为可复用的业务动作。
- 提供 Tauri 适配器（data 层），把端口调用转换为 Tauri command 或 API 调用。

不做什么：

- 不包含业务 UI（页面/组件），平台能力只提供“动作”。
- 不保存业务状态（如当前频道/用户），只接受调用方传入的参数。

## 主要入口（导航）

- 领域端口：`src/features/platform/domain/ports/WindowCommandsPort.ts`
- 领域用例：`src/features/platform/domain/usecases/`
  - `OpenInfoWindow.ts`
  - `OpenPopoverWindow.ts`
  - `ResizeChatWindow.ts`
- Tauri 适配器：`src/features/platform/data/tauriWindowCommandsAdapter.ts`

## 目录结构

- `domain/`：平台能力 ports/usecases。
- `data/`：Tauri 实现（调用 `src/shared/tauri/*`）。
- `di/`：装配与对外提供方式。

## 与其他模块的协作

- `chat`：常用来控制聊天主窗体布局与弹出窗口（例如用户信息 popover）。
- `shared/tauri/*`：platform 的 data 适配器通常复用 shared 的 invoke/events 基础设施。
