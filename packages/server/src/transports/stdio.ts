/**
 * stdio Transport — JSON-RPC over stdin/stdout (NDJSON)
 *
 * 对应 06-详细设计文档 v4.2 §4.8 stdio Transport 详细设计
 * 适用: CLI / TUI 客户端与后端子进程通信
 *
 * 每条 JSON-RPC 消息单行 NDJSON,\n 分隔;
 * stderr 不进入协议通道,仅用于日志。
 */
import { createInterface } from 'node:readline';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
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

const log = moduleLogger('StdioTransport');

export class StdioTransportServer implements TransportServer {
  readonly kind = 'stdio' as const;

  private handlers = new Map<string, MethodHandler>();
  private connectCallbacks: Array<(c: ClientSession) => void> = [];
  private disconnectCallbacks: Array<(c: ClientSession) => void> = [];
  private client: ClientSession;
  private started = false;

  constructor() {
    this.client = {
      id: 'stdio-client',
      transport: 'stdio',
      connectedAt: Date.now(),
      subscriptions: new Set(),
    };
  }

  async start(_opts?: { port?: number; host?: string }): Promise<TransportEndpoint> {
    if (this.started) return { address: 'stdio', kind: 'stdio' };
    this.started = true;

    const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
    rl.on('line', (line) => this.onLine(line).catch((err) => log.error('line handler error', { error: (err as Error).message })));
    rl.on('close', () => {
      log.info('stdin closed, stdio transport shutting down');
      for (const cb of this.disconnectCallbacks) cb(this.client);
    });

    for (const cb of this.connectCallbacks) cb(this.client);
    log.info('StdioTransport started');
    return { address: 'stdio', kind: 'stdio' };
  }

  async stop(): Promise<void> {
    log.debug('stop (stdio transport)');
    for (const cb of this.disconnectCallbacks) cb(this.client);
  }

  handle(method: string, handler: MethodHandler): void {
    this.handlers.set(method, handler);
  }

  unhandle(method: string): void {
    this.handlers.delete(method);
  }

  notify(_clientId: string, method: string, params: unknown): void {
    this.send({ jsonrpc: '2.0', id: null, method, params } as JsonRpcNotification);
  }

  stream(clientId: string, id: string | number, chunk: unknown): void {
    this.send({ jsonrpc: '2.0', id, result: { stream: 'chunk', ...((chunk as Record<string, unknown>) ?? {}) } });
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

  /** 处理一行 NDJSON */
  private async onLine(line: string): Promise<void> {
    if (!line.trim()) return;
    let req: JsonRpcRequest;
    try {
      req = JSON.parse(line);
    } catch (err) {
      this.send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      return;
    }

    const ctx: CallContext = {
      clientId: this.client.id,
      transport: 'stdio',
      cancelSignal: new AbortController().signal,
    };

    // 通知 (id 为 null) 不返回响应
    if (req.id === null) {
      const handler = this.handlers.get(req.method);
      if (handler) {
        try {
          await handler(req, ctx);
        } catch (err) {
          log.error('notification handler error', { method: req.method, error: (err as Error).message });
        }
      }
      return;
    }

    const handler = this.handlers.get(req.method);
    if (!handler) {
      this.send({ jsonrpc: '2.0', id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } });
      return;
    }

    try {
      const result = await handler(req, ctx);
      // 流式: AsyncIterable
      if (result && typeof (result as AsyncIterable<unknown>)[Symbol.asyncIterator] === 'function') {
        for await (const chunk of result as AsyncIterable<unknown>) {
          this.send({ jsonrpc: '2.0', id: req.id, result: { stream: 'chunk', ...(chunk as Record<string, unknown>) } });
        }
        this.send({ jsonrpc: '2.0', id: req.id, result: { stream: 'end' } });
      } else {
        this.send({ jsonrpc: '2.0', id: req.id, result });
      }
    } catch (err) {
      const e = err as Error & { code?: number };
      this.send({
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: e.code ?? -32603,
          message: e.message,
        },
      });
    }
  }

  /** 写一行 NDJSON 到 stdout */
  private send(msg: JsonRpcResponse | JsonRpcNotification): void {
    try {
      const line = JSON.stringify(msg) + '\n';
      const canWrite = process.stdout.write(line);
      if (!canWrite) {
        // 背压处理: 暂停读取 stdin 直到 drain
        process.stdin.pause();
        process.stdout.once('drain', () => process.stdin.resume());
      }
    } catch (err) {
      log.error('send failed', { error: (err as Error).message });
    }
  }
}
