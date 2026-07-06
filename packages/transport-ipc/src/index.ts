/**
 * @opencode/transport-ipc — Electron IPC Transport 客户端 (Renderer 侧)
 *
 * 通过 preload 注入的 window.opencode 桥接与 Main 进程通信。
 * 用于 apps/desktop Renderer 与嵌入式后端之间的零序列化通信。
 */
export * from './bridge.js';
export * from './transport.js';
