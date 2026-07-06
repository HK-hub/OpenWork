/**
 * Electron IPC Transport Server — 后端侧 (在 Main Process 中)
 *
 * 对应 06-详细设计文档 v4.2 §4.9 Electron IPC Transport 详细设计
 *
 * 通过 ipcMain.handle 接收 Renderer 调用,转发到 handler。
 * 后端事件通过 webContents.send 推送给 Renderer。
 *
 * 注意: 本类不直接依赖 electron,使用 ipcRenderer 接口抽象,
 * 由 apps/desktop/main/ipc.ts 实际注入 electron 的 ipcMain。
 */
import type {
  JsonRpcRequest,
  JsonRpcNotification,
} from '@opencode/api';
import type {
  TransportServer,
  TransportEndpoint,
  MethodHandler,
  ClientSession,
  CallContext,
} from './types.js';
import { genRawId, moduleLogger } from '@opencode/core';

const log = moduleLogger('IpcTransport');

/** IPC 渲染端句柄 (由 Electron Main 注入) */
export interface IpcRendererHandle {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (...args: unknown[]) => void): void;
}

/** IPC Main 句柄 (由 apps/desktop/main 注入) */
export interface IpcMainHandle {
  handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void;
  removeHandler(channel: string): void;
}

/** BrowserWindow 句柄 (用于向 Renderer 推送事件) */
export interface BrowserWindowHandle {
  webContents: {
    send(channel: string, ...args: unknown[]): void;
  };
}

export class IpcTransportServer implements TransportServer {
  readonly kind = 'ipc' as const;

  private handlers = new Map<string, MethodHandler>();
  private connectCallbacks: Array<(c: ClientSession) => void> = [];
  private disconnectCallbacks: Array<(c: ClientSession) => void> = [];
  private clients = new Map<string, ClientSession>();
  private windows: BrowserWindowHandle[] = [];
  private ipcMain: IpcMainHandle | null = null;
  private started = false;

  /** 注入 Electron IPC (在 apps/desktop/main/ipc.ts 中调用) */
  attach(ipcMain: IpcMainHandle, windows: BrowserWindowHandle[]): void {
    this.ipcMain = ipcMain;
    this.windows = windows;

    ipcMain.handle('opencode:call', async (_e, ...args: unknown[]) => {
      const payload = args[0] as { method: string; params: unknown };
      return this.handleCall(payload.method, payload.params);
    });

    ipcMain.handle('opencode:stream', async (_e, ...args: unknown[]) => {
      const payload = args[0] as { method: string; params: unknown };
      return this.handleStream(payload.method, payload.params);
    });

    log.info('IpcTransport attached to ipcMain');
  }

  /** 注册新的 BrowserWindow (支持多窗口) */
  addWindow(window: BrowserWindowHandle): void {
    this.windows.push(window);
    log.debug('window added', { count: this.windows.length });
  }

  /** 移除 BrowserWindow */
  removeWindow(window: BrowserWindowHandle): void {
    const idx = this.windows.indexOf(window);
    if (idx >= 0) {
      this.windows.splice(idx, 1);
      log.debug('window removed', { count: this.windows.length });
    }
  }

  async start(_opts?: { port?: number; host?: string }): Promise<TransportEndpoint> {
    this.started = true;
    const client: ClientSession = {
      id: 'ipc-renderer',
      transport: 'ipc',
      connectedAt: Date.now(),
      subscriptions: new Set(),
    };
    this.clients.set(client.id, client);
    for (const cb of this.connectCallbacks) cb(client);
    log.info('IpcTransport started');
    return { address: 'ipc', kind: 'ipc' };
  }

  async stop(): Promise<void> {
    if (this.ipcMain) {
      this.ipcMain.removeHandler('opencode:call');
      this.ipcMain.removeHandler('opencode:stream');
    }
    for (const cb of this.disconnectCallbacks) {
      for (const client of this.clients.values()) cb(client);
    }
    this.clients.clear();
    log.info('IpcTransport stopped');
  }

  handle(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  unhandle(method: string): void {
    this.handlers.delete(method);
  }

  notify(_clientId: string, method: string, params: unknown): void {
    this.broadcast(method, params);
  }

  stream(_clientId: string, id: string | number, chunk: unknown): void {
    for (const w of this.windows) {
      w.webContents.send('opencode:event:stream', { id, chunk });
    }
  }

  broadcast(method: string, params: unknown): void {
    const channel = `opencode:event:${method}`;
    for (const w of this.windows) {
      w.webContents.send(channel, params);
    }
  }

  getClients(): ClientSession[] {
    return Array.from(this.clients.values());
  }

  onConnect(cb: (c: ClientSession) => void): void {
    this.connectCallbacks.push(cb);
  }

  onDisconnect(cb: (c: ClientSession) => void): void {
    this.disconnectCallbacks.push(cb);
  }

  /** 处理 IPC 调用 (call: 单次请求) */
  private async handleCall(method: string, params: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
    }
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: genRawId(8),
      method,
      params,
    };
    const ctx: CallContext = {
      clientId: 'ipc-renderer',
      transport: 'ipc',
      cancelSignal: new AbortController().signal,
    };
    return handler(req, ctx);
  }

  /** 处理流式调用 (stream: 多次推送) */
  private async handleStream(method: string, params: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw Object.assign(new Error(`Method not found: ${method}`), { code: -32601 });
    }
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: genRawId(8),
      method,
      params,
    };
    const ctx: CallContext = {
      clientId: 'ipc-renderer',
      transport: 'ipc',
      cancelSignal: new AbortController().signal,
    };
    const result = await handler(req, ctx);
    if (result && typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
      const chunks: unknown[] = [];
      for await (const chunk of result as AsyncIterable<unknown>) {
        chunks.push(chunk);
      }
      return chunks;
    }
    return result;
  }
}
