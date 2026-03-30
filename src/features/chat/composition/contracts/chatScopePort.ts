/**
 * @fileoverview chat runtime scope 类型别名。
 * @description
 * 该文件保留给 presentation/store/live 使用，实际类型定义已下沉到 chat/application/ports。
 *
 * 这样做是为了让 presentation/runtime 继续显式表达“我依赖的是 chat scope”，
 * 而不是直接耦合 application/ports 的文件路径。
 */

export type { ChatRuntimeScopePort } from "@/features/chat/domain/ports/runtimePorts";
