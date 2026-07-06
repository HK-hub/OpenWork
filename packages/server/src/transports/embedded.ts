/**
 * Embedded Transport — 嵌入式模式 (零序列化)
 *
 * 后端与前端同进程,直接调用 handler,无 JSON.stringify / 无 IPC / 无网络。
 * 用于最大化性能与最小化部署复杂度 (Desktop 默认模式)。
 *
 * 对应 06-详细设计文档 v4.2 §4.10 Embedded Transport 详细设计
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

const log = moduleLogger('EmbeddedTransport');

export class EmbeddedTransport implements TransportServer {
  readonly kind = 'embedded' as const;

  private handlers = new Map<string, MethodHandler>();
  private connectCallbacks: Array<(c: ClientSession) => void> = [];
  private disconnectCallbacks: Array<(c: ClientSession) => void> = [];
  private client: ClientSession;
  private notificationListeners: Array<(n: JsonRpcNotification) => void> = [];

  constructor() {
    this.client = {
      id: 'embedded-client',
      transport: 'embedded',
      connectedAt: Date.now(),
      subscriptions: new Set(),
    };
    log.info('EmbeddedTransport created');
  }

  async start(_opts?: { port?: number; host?: string }): Promise<TransportEndpoint> {
    log.debug('start (no-op for embedded)');
    // 触发连接回调
    for (const cb of this.connectCallbacks) cb(this.client);
    return { address: 'embedded', kind: 'embedded' };
  }

  async stop(): Promise<void> {
    log.debug('stop (no-op for embedded)');
    for (const cb of this.disconnectCallbacks) cb(this.client);
  }

  handle(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  unhandle(method: string): void {
    this.handlers.delete(method);
  }

  notify(_clientId: string, method: string, params: unknown): void {
    const notif: JsonRpcNotification = {
      jsonrpc: '2.0',
      id: null,
      method,
      params,
    };
    for (const listener of this.notificationListeners) {
      listener(notif);
    }
  }

  stream(_clientId: string, id: string | number, chunk: unknown): void {
    // 嵌入式模式: 直接调用 listener (无 SSE 帧)
    this.notify('embedded', 'stream', { id, chunk });
  }

  broadcast(method: string, params: unknown): void {
    this.notify(this.client.id, method, params);
  }

  getClients(): ClientSession[] {
    return [this.client];
  }

  onConnect(cb: (c: ClientSession) => void): void {
    this.connectCallbacks.push(cb);
  }

  onDisconnect(cb: (c: ClientSession) => void): void {
    this.disconnectCallbacks.push(cb);
  }

  /** 嵌入式特有: 订阅通知 (前端通过此接收事件) */
  onNotification(cb: (n: JsonRpcNotification) => void): () => void {
    this.notificationListeners.push(cb);
    return () => {
      const idx = this.notificationListeners.indexOf(cb);
      if (idx >= 0) this.notificationListeners.splice(idx, 1);
    };
  }

  /** 直接调用 handler (供 BackendServiceHost 使用,绕过 JSON-RPC 序列化) */
  async invoke(method: string, params: unknown): Promise<unknown> {
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
      clientId: this.client.id,
      transport: 'embedded',
      cancelSignal: AbortSignal.timeout(30000),
    };
    return handler(req, ctx);
  }

  /** 流式调用 handler */
  async *invokeStream(method: string, params: unknown): AsyncIterable<unknown> {
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
      clientId: this.client.id,
      transport: 'embedded',
      cancelSignal: new AbortController().signal,
    };
    const iter = await handler(req, ctx);
    if (iter && typeof (iter as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
      yield* iter as AsyncIterable<unknown>;
    } else {
      yield iter;
    }
  }
}
