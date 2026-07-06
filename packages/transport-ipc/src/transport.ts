/**
 * Electron IPC Transport 客户端 — Renderer 侧实现
 *
 * 实现 @opencode/api 的 TransportClient 接口,
 * 通过 window.opencode (preload 注入) 与 Main 进程通信。
 *
 * 对应 06-详细设计文档 v4.2 §4.9 Electron IPC Transport 详细设计。
 *
 * 注意:
 * - 由于 ipcRenderer.invoke 不能持续推送 chunk,stream() 方法返回数组,
 *   到达 Renderer 后一次性 yield 完所有 chunk (语义保持一致)。
 * - 若需真正流式体验,可通过 'opencode:event:stream' 频道订阅 (TODO v0.2)。
 */
import type {
  CallOpts,
  TransportClient,
  TransportConnectOpts,
  TransportKind,
} from '@opencode/api';
import type { JsonRpcNotification } from '@opencode/api';
import { getIpcBridge, type IpcBridge } from './bridge.js';

interface Subscription {
  id: string;
  events: string[];
  cb: (n: JsonRpcNotification) => void;
  unsub: () => void;
}

export class IpcTransportClient implements TransportClient {
  readonly kind: TransportKind = 'ipc';

  private bridge: IpcBridge | null = null;
  private connected = false;
  private connectCbs: Array<() => void> = [];
  private disconnectCbs: Array<() => void> = [];
  private errorCbs: Array<(err: Error) => void> = [];
  private subscriptions = new Map<string, Subscription>();
  private subSeq = 0;

  constructor(bridge?: IpcBridge) {
    if (bridge) {
      this.bridge = bridge;
    }
  }

  async connect(_opts?: TransportConnectOpts): Promise<void> {
    if (this.connected) return;
    if (!this.bridge) {
      this.bridge = getIpcBridge();
    }
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
    if (!this.connected) return;
    // 取消所有订阅
    for (const sub of this.subscriptions.values()) {
      try {
        sub.unsub();
      } catch {
        /* ignore */
      }
    }
    this.subscriptions.clear();
    this.connected = false;
    for (const cb of this.disconnectCbs) {
      try {
        cb();
      } catch (err) {
        this.fireError(err as Error);
      }
    }
  }

  async call<R>(method: string, params?: unknown, opts?: CallOpts): Promise<R> {
    this.ensureConnected();
    if (opts?.abort?.aborted) {
      throw new Error(`Call aborted: ${method}`);
    }
    if (opts?.abort) {
      opts.abort.addEventListener(
        'abort',
        () => {
          // IPC 不支持中途取消,只能让结果忽略 (TODO: 通过主进程 signal 实现)
        },
        { once: true },
      );
    }
    try {
      const result = await this.bridge!.call(method, params);
      return result as R;
    } catch (err) {
      const e = err as Error & { code?: number };
      throw Object.assign(new Error(e.message), { code: e.code ?? -32603 });
    }
  }

  async *stream<R>(
    method: string,
    params?: unknown,
    opts?: CallOpts,
  ): AsyncIterable<R> {
    this.ensureConnected();
    if (opts?.abort?.aborted) {
      throw new Error(`Stream aborted: ${method}`);
    }
    let chunks: unknown[];
    try {
      chunks = (await this.bridge!.stream(method, params)) as unknown[];
    } catch (err) {
      const e = err as Error & { code?: number };
      throw Object.assign(new Error(e.message), { code: e.code ?? -32603 });
    }
    for (const chunk of chunks) {
      if (opts?.abort?.aborted) break;
      yield chunk as R;
    }
  }

  notify(method: string, params?: unknown): void {
    this.ensureConnected();
    // IPC 单向通知: 通过事件订阅模式发送 'opencode:notify' (约定)
    // Main 进程订阅 'opencode:event:notify' 即可接收。
    // 简化实现: 直接调用 call,但忽略结果。
    void this.bridge!.call(method, params).catch(() => {
      /* 通知忽略错误 */
    });
  }

  async subscribe(
    events: string[],
    cb: (evt: JsonRpcNotification) => void,
  ): Promise<string> {
    this.ensureConnected();
    const id = `sub_${++this.subSeq}`;
    // 合并多事件为单一订阅,通过 bridge.on 监听每个事件
    const unsubs: Array<() => void> = [];
    for (const evt of events) {
      const unsub = this.bridge!.on(evt, (payload) => {
        cb({
          jsonrpc: '2.0',
          id: null,
          method: evt,
          params: payload,
        });
      });
      unsubs.push(unsub);
    }
    this.subscriptions.set(id, {
      id,
      events,
      cb,
      unsub: () => {
        for (const u of unsubs) {
          try {
            u();
          } catch {
            /* ignore */
          }
        }
      },
    });
    return id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return;
    sub.unsub();
    this.subscriptions.delete(subscriptionId);
  }

  onConnect(cb: () => void): void {
    this.connectCbs.push(cb);
    if (this.connected) {
      // 已连接则立即触发
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

  private ensureConnected(): void {
    if (!this.connected) {
      throw new Error('Transport not connected. Call connect() first.');
    }
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

/** 创建 IPC Transport 客户端 (默认从 window.opencode 获取桥接) */
export function createIpcTransport(bridge?: IpcBridge): IpcTransportClient {
  return new IpcTransportClient(bridge);
}
