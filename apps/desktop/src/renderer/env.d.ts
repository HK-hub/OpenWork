/**
 * Renderer 全局类型声明
 */
import type { IpcBridge } from '@opencode/transport-ipc';

declare global {
  interface Window {
    opencode: IpcBridge;
  }
}

export {};
