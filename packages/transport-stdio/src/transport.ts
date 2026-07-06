/**
 * stdio Transport 客户端 — Node.js 子进程 (CLI / TUI 用)
 *
 * 实现 @opencode/api 的 TransportClient 接口,
 * 通过 child_process.spawn 启动后端进程,以 NDJSON 通信。
 *
 * 对应 06-详细设计文档 v4.2 §4.8 stdio Transport 详细设计。
 *
 * v0.1: 骨架实现,仅供 v0.2+ TUI/CLI 使用。
 * v0.2+ 待补充: 重连、错误恢复、SSE 风格流式 chunk 推送。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type {
  CallOpts,
  TransportClient,
  TransportConnectOpts,
  TransportKind,
} from '@opencode/api';
import type {
  JsonRpcNotification,
  JsonRpcResponse,
  RpcId,
} from '@opencode/api';

/** stdio 连接配置 */
export interface StdioConnectOpts extends TransportConnectOpts {
  /** 后端可执行文件路径 (默认 'node') */
  command?: string;
  /** 启动参数 (默认 ['./node_modules/@opencode/server/dist/index.js']) */
  args?: string[];
  /** 工作目录 */
  cwd?: string;
  /** 环境变量 */
  env?: Record<string, string>;
}

interface PendingRequest {
  id: RpcId;
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
  /** 流式回调 (可选);设置后每次 chunk 调用,最后 end 时 resolve */
  onChunk?: (chunk: unknown) => void;
  /** 是否流式 */
  isStream?: boolean;
}

interface Subscription {
  id: string;
  events: string[];
  cb: (n: JsonRpcNotification) => void;
}

export class StdioTransportClient implements TransportClient {
  readonly kind: TransportKind = 'stdio';

  private proc: ChildProcess | null = null;
  private rl: ReturnType<typeof createInterface> | null = null;
  private pending = new Map<RpcId, PendingRequest>();
  private subscriptions = new Map<string, Subscription>();
  private subSeq = 0;
  private reqSeq = 0;
  private connected = false;
  private connectCbs: Array<() => void> = [];
  private disconnectCbs: Array<() => void> = [];
  private errorCbs: Array<(err: Error) => void> = [];

  async connect(opts?: StdioConnectOpts): Promise<void> {
    if (this.connected) return;
    const command = opts?.command ?? 'node';
    const args = opts?.args ?? ['./node_modules/@opencode/server/dist/index.js'];
    const env = { ...process.env, ...opts?.env } as Record<string, string>;

    this.proc = spawn(command, args, {
      cwd: opts?.cwd ?? process.cwd(),
      env,
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    this.proc.on('error', (err) => {
      this.fireError(err);
    });

    this.proc.on('exit', (code, signal) => {
      this.connected = false;
      const err = new Error(
        `stdio backend exited: code=${code} signal=${signal ?? 'null'}`,
      );
      // reject 所有 pending 请求
      for (const pending of this.pending.values()) {
        pending.reject(err);
      }
      this.pending.clear();
      for (const cb of this.disconnectCbs) {
        try {
          cb();
        } catch {
          /* ignore */
        }
      }
    });

    this.rl = createInterface({ input: this.proc.stdout!, crlfDelay: Infinity });
    this.rl.on('line', (line) => this.onLine(line));

    this.connected = true;
    for (const cb of this.connectCbs) {
      try {
        cb();
      } catch (err) {
        this.fireError(err as Error);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.proc) return;
    this.connected = false;
    this.rl?.close();
    this.rl = null;
    // 优雅关闭
    this.proc.stdin?.end();
    // 等待退出或强制
    const proc = this.proc;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve();
      }, 3000);
      proc.once('exit', () => {
        clearTimeout(t);
        resolve();
      });
    });
    this.proc = null;
    this.subscriptions.clear();
  }

  async call<R>(method: string, params?: unknown, opts?: CallOpts): Promise<R> {
    this.ensureConnected();
    const id = `c${++this.reqSeq}`;
    const req = { jsonrpc: '2.0' as const, id, method, params };

    const timeoutMs = opts?.timeoutMs ?? 30000;
    return new Promise<R>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      if (timeoutMs > 0) {
        timer = setTimeout(() => {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method} (${timeoutMs}ms)`));
        }, timeoutMs);
      }

      this.pending.set(id, {
        id,
        resolve: (v) => {
          if (timer) clearTimeout(timer);
          resolve(v as R);
        },
        reject: (err) => {
          if (timer) clearTimeout(timer);
          reject(err);
        },
      });

      opts?.abort?.addEventListener(
        'abort',
        () => {
          this.pending.delete(id);
          reject(new Error(`Call aborted: ${method}`));
        },
        { once: true },
      );

      this.send(req);
    });
  }

  async *stream<R>(
    method: string,
    params?: unknown,
    opts?: CallOpts,
  ): AsyncIterable<R> {
    this.ensureConnected();
    const id = `s${++this.reqSeq}`;
    const req = { jsonrpc: '2.0' as const, id, method, params };

    const queue: Array<{ value?: R; done: boolean; error?: Error }> = [];
    let resolveNext: ((v: { value?: R; done: boolean; error?: Error }) => void) | null = null;

    const onChunk = (chunk: unknown) => {
      const item = { value: chunk as R, done: false };
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r(item);
      } else {
        queue.push(item);
      }
    };

    const onEnd = (result: unknown) => {
      const item = { value: result as R, done: true };
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r(item);
      } else {
        queue.push(item);
      }
    };

    const onError = (err: Error) => {
      const item = { done: true, error: err };
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r(item);
      } else {
        queue.push(item);
      }
    };

    this.pending.set(id, {
      id,
      resolve: (final) => onEnd(final),
      reject: onError,
      isStream: true,
      onChunk,
    });

    opts?.abort?.addEventListener(
      'abort',
      () => {
        this.pending.delete(id);
        // 发送取消通知
        this.send({ jsonrpc: '2.0', id: null, method: '$/cancel', params: { id } });
      },
      { once: true },
    );

    this.send(req);

    try {
      while (true) {
        if (queue.length > 0) {
          const item = queue.shift()!;
          if (item.error) throw item.error;
          if (item.done) {
            return item.value as R; // 流式结束
          }
          yield item.value as R;
        } else {
          const item = await new Promise<{ value?: R; done: boolean; error?: Error }>(
            (resolve) => {
              resolveNext = resolve;
            },
          );
          if (item.error) throw item.error;
          if (item.done) {
            return item.value as R;
          }
          yield item.value as R;
        }
      }
    } finally {
      this.pending.delete(id);
    }
  }

  notify(method: string, params?: unknown): void {
    this.ensureConnected();
    this.send({ jsonrpc: '2.0', id: null, method, params });
  }

  async subscribe(
    events: string[],
    cb: (evt: JsonRpcNotification) => void,
  ): Promise<string> {
    this.ensureConnected();
    const id = `sub_${++this.subSeq}`;
    this.subscriptions.set(id, { id, events, cb });
    // 发送订阅通知
    this.send({
      jsonrpc: '2.0',
      id: null,
      method: '$/subscribe',
      params: { events, subscriptionId: id },
    });
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;
    this.subscriptions.delete(subscriptionId);
    this.send({
      jsonrpc: '2.0',
      id: null,
      method: '$/unsubscribe',
      params: { subscriptionId },
    });
  }

  onConnect(cb: () => void): void {
    this.connectCbs.push(cb);
    if (this.connected) {
      try {
        cb();
      } catch (err) {
        this.fireError(err as Error);
      }
    }
  }

  onDisconnect(cb: () => void): void {
    this.disconnectCbs.push(cb);
  }

  onError(cb: (err: Error) => void): void {
    this.errorCbs.push(cb);
  }

  // ════════════════════════════════════════
  // 内部实现
  // ════════════════════════════════════════
  private ensureConnected(): void {
    if (!this.connected || !this.proc) {
      throw new Error('stdio transport not connected. Call connect() first.');
    }
  }

  private send(msg: unknown): void {
    if (!this.proc?.stdin?.writable) {
      this.fireError(new Error('Backend stdin not writable'));
      return;
    }
    const line = JSON.stringify(msg) + '\n';
    const stdin = this.proc.stdin as unknown as {
      write: (data: string) => boolean;
      pause: () => void;
      resume: () => void;
      once: (event: string, cb: () => void) => void;
    };
    const canWrite = stdin.write(line);
    if (!canWrite) {
      // 背压处理
      stdin.pause();
      stdin.once('drain', () => {
        const s = this.proc?.stdin as unknown as { resume: () => void } | null | undefined;
        s?.resume();
      });
    }
  }

  private onLine(line: string): void {
    if (!line.trim()) return;
    let msg: JsonRpcResponse | JsonRpcNotification;
    try {
      msg = JSON.parse(line);
    } catch {
      this.fireError(new Error(`Invalid NDJSON from backend: ${line}`));
      return;
    }

    // 通知 (id 为 null)
    if (msg.id === null || msg.id === undefined) {
      const method = (msg as JsonRpcNotification).method;
      const params = (msg as JsonRpcNotification).params;
      for (const sub of this.subscriptions.values()) {
        if (sub.events.includes(method) || sub.events.includes('*')) {
          try {
            sub.cb({ jsonrpc: '2.0', id: null, method, params });
          } catch (err) {
            this.fireError(err as Error);
          }
        }
      }
      return;
    }

    // 响应
    const pending = this.pending.get(msg.id);
    if (!pending) {
      // 可能是流式 chunk 或已取消
      return;
    }

    const resp = msg as JsonRpcResponse;
    if (resp.error) {
      pending.reject(
        Object.assign(new Error(resp.error.message), { code: resp.error.code }),
      );
      this.pending.delete(msg.id);
      return;
    }

    const result = resp.result as { stream?: 'chunk' | 'end' } & Record<string, unknown>;
    // 流式 chunk
    if (result?.stream === 'chunk' && pending.isStream) {
      pending.onChunk?.(result);
      return; // 流式进行中,不删除 pending
    }

    // 流式 end 或普通响应
    if (result?.stream === 'end' && pending.isStream) {
      pending.resolve(undefined);
      this.pending.delete(msg.id);
      return;
    }

    // 普通响应
    pending.resolve(resp.result);
    this.pending.delete(msg.id);
  }

  private fireError(err: Error): void {
    for (const cb of this.errorCbs) {
      try {
        cb(err);
      } catch {
        /* ignore */
      }
    }
  }
}

/** 创建 stdio Transport 客户端 */
export function createStdioTransport(): StdioTransportClient {
  return new StdioTransportClient();
}
