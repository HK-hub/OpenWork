/**
 * Electron IPC 桥接接口 — Renderer 侧
 *
 * 由 apps/desktop/preload.ts 通过 contextBridge.exposeInMainWorld('opencode', ...)
 * 注入到 Renderer 全局对象 window.opencode。
 *
 * 对应 06-详细设计文档 v4.2 §4.9.1 preload 暴露约定。
 */
export interface IpcBridge {
  /** 单次调用 (返回 Promise) */
  call(method: string, params: unknown): Promise<unknown>;
  /** 流式调用 (返回 chunk 数组,因为 ipcRenderer.invoke 不能持续推送) */
  stream(method: string, params: unknown): Promise<unknown[]>;
  /** 订阅事件,返回取消订阅函数 */
  on(event: string, cb: (payload: unknown) => void): () => void;
}

/** 在 Renderer 中获取 window.opencode 桥接对象 */
export function getIpcBridge(): IpcBridge {
  const w = globalThis as unknown as { opencode?: IpcBridge };
  if (!w.opencode) {
    throw new Error(
      'window.opencode is not available — preload script not loaded. ' +
        'Ensure apps/desktop/preload.ts is configured in BrowserWindow.webPreferences.preload.',
    );
  }
  return w.opencode;
}

/** 安全获取桥接 (返回 null 而非抛错,用于环境检测) */
export function maybeGetIpcBridge(): IpcBridge | null {
  const w = globalThis as unknown as { opencode?: IpcBridge };
  return w.opencode ?? null;
}

/** 是否在 Electron Renderer 环境中 */
export function isElectronRenderer(): boolean {
  return maybeGetIpcBridge() !== null;
}
