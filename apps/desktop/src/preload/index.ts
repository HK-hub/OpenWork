/**
 * Electron Preload — Renderer 隔离层
 *
 * 对应 06-详细设计文档 v4.2 §4.9.1 preload 暴露约定
 *
 * 通过 contextBridge.exposeInMainWorld('opencode', ...) 注入到 Renderer,
 * 实现 @opencode/transport-ipc 的 IpcBridge 接口。
 *
 * 安全约束 (§4.9.2):
 *  - contextIsolation: true (Main 配置)
 *  - nodeIntegration: false
 *  - 仅暴露 opencode.* 通道,不暴露 ipcRenderer 对象本身
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// 渲染端通过 window.opencode 调用,签名匹配 @opencode/transport-ipc 的 IpcBridge
const api = {
  /** 单次调用 (返回 Promise) */
  call(method: string, params: unknown): Promise<unknown> {
    return ipcRenderer.invoke('opencode:call', { method, params });
  },

  /** 流式调用 (Main 收集 chunks 后一次返回) */
  stream(method: string, params: unknown): Promise<unknown[]> {
    return ipcRenderer.invoke('opencode:stream', { method, params }) as Promise<unknown[]>;
  },

  /** 订阅事件,返回取消订阅函数 */
  on(event: string, cb: (payload: unknown) => void): () => void {
    const channel = `opencode:event:${event}`;
    const listener = (_e: IpcRendererEvent, payload: unknown): void => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => {
      ipcRenderer.removeListener(channel, listener);
    };
  },
};

// 注入到 window.opencode (contextIsolation: true)
contextBridge.exposeInMainWorld('opencode', api);

// 类型导出供 Renderer 使用 (window.opencode 全局类型)
export type OpencodeBridge = typeof api;
