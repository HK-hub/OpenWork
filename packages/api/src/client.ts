/**
 * OpenCodeClient — 前端统一客户端 SDK
 *
 * 封装 TransportClient,提供类型安全 (基于本包 ApiMethods)、
 * 自动重连、请求超时、流式处理与事件订阅。
 *
 * 对应 06-详细设计文档 §4.5
 */
import type { JsonRpcNotification, RpcId } from './protocol.js';
import type { AppEvent, EventFilter } from './events.js';

// ════════════════════════════════════════
// TransportClient 接口 (前端用)
// ════════════════════════════════════════
export type TransportKind = 'http' | 'ws' | 'stdio' | 'ipc' | 'embedded';

export interface TransportClient {
  readonly kind: TransportKind;
  connect(opts?: TransportConnectOpts): Promise<void>;
  disconnect(): Promise<void>;
  /** 单次调用 (返回 Promise) */
  call<R>(method: string, params?: unknown, opts?: CallOpts): Promise<R>;
  /** 流式调用 (返回异步迭代) */
  stream<R>(method: string, params?: unknown, opts?: CallOpts): AsyncIterable<R>;
  /** 发送通知 (无响应) */
  notify(method: string, params?: unknown): void;
  /** 订阅事件 */
  subscribe(
    events: string[],
    cb: (evt: JsonRpcNotification) => void,
  ): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  /** 生命周期 */
  onConnect(cb: () => void): void;
  onDisconnect(cb: () => void): void;
  onError(cb: (err: Error) => void): void;
}

export interface TransportConnectOpts {
  timeoutMs?: number;
}

export interface CallOpts {
  timeoutMs?: number;
  abort?: AbortSignal;
}

// ════════════════════════════════════════
// 客户端配置
// ════════════════════════════════════════
export interface ClientOpts {
  requestTimeoutMs?: number; // 默认 30000;agent.run 等长方法设 0=不限
  reconnect?: {
    enabled: boolean;
    maxRetries: number;
    backoffMs: number;
  };
  auth?: {
    token?: string;
    headers?: Record<string, string>;
  };
}

// ════════════════════════════════════════
// 方法映射类型 (用于类型安全调用)
// ════════════════════════════════════════
/**
 * 所有 API 方法映射表,由 @opencode/api 各域合并而成。
 * 后端 BackendServiceHost 注册 handler 时使用此类型约束。
 */
export interface ApiMethods {
  // v0.1 必需域
  'session.create': { params: { projectId: string; title?: string; mode?: string }; result: { sessionId: string; createdAt: number } };
  'session.list': { params: { projectId?: string; limit?: number; cursor?: string }; result: { items: unknown[]; nextCursor?: string } };
  'session.get': { params: { sessionId: string }; result: unknown };
  'session.delete': { params: { sessionId: string }; result: { deleted: true } };
  'session.export': { params: { sessionId: string; format?: string }; result: { url: string; bytes: number } };
  'session.fork': { params: { sessionId: string; fromMessageId?: string }; result: { newSessionId: string } };

  'agent.run': {
    params: {
      sessionId: string;
      prompt: string;
      mode?: string;
      tools?: string[];
      budget?: { hardCapUsd?: number; maxIterations?: number };
      stream?: boolean;
      /** 显式覆盖模型 ID (如 'anthropic/claude-sonnet-4') */
      model?: string;
      /** 显式覆盖 provider */
      provider?: string;
      /** 推理参数覆盖 */
      params?: { temperature?: number; maxTokens?: number; topP?: number; stop?: string[] };
    };
    result: { runId: string; status: string };
    stream: { stream: 'chunk' | 'end'; delta?: string; runId?: string; status?: string; usage?: { input: number; output: number; costUsd: number }; finalText?: string };
  };
  'agent.stop': { params: { runId: string; reason?: string }; result: { stopped: true } };
  'agent.pause': { params: { runId: string }; result: { status: 'paused'; checkpointId: string } };
  'agent.resume': { params: { runId: string }; result: { status: 'running' } };
  'agent.step': { params: { runId: string; kind?: string }; result: { stepId: string; action: string; status: string } };
  'agent.inspect': { params: { runId: string }; result: unknown };

  'tool.list': { params: { category?: string; enabled?: boolean }; result: { tools: unknown[] } };
  'tool.execute': { params: { tool: string; args?: Record<string, unknown>; sessionId?: string; approvalToken?: string }; result: { callId: string; output: unknown; meta?: Record<string, unknown> } };
  'tool.approve': { params: { approvalToken: string; decision: 'allow' | 'deny'; scope?: string }; result: { granted: true } };

  'config.get': { params: { key?: string; profile?: string }; result: { value: unknown } };
  'config.set': { params: { key: string; value: unknown; profile?: string }; result: { validated: true; oldValue: unknown } };
  'config.list': { params: { profile?: string }; result: { entries: unknown[] } };
  'config.validate': { params: { config: Record<string, unknown> }; result: { valid: boolean; errors: unknown[] } };

  'profile.list': { params: Record<string, never>; result: { profiles: unknown[] } };
  'profile.create': { params: { name: string; base?: string; provider: string; model: string; params?: unknown }; result: { profileId: string } };
  'profile.switch': { params: { profileId: string }; result: { active: string } };
  'profile.export': { params: { profileId: string }; result: { url: string; bytes: number } };
  'profile.import': { params: { source: string }; result: { profileId: string } };

  'permission.request': { params: { scope: string; resource: string; ttl?: number }; result: { approvalToken: string; expiresAt: number; ttl: number } };
  'permission.grant': { params: { approvalToken: string; scope?: string }; result: { granted: true } };
  'permission.revoke': { params: { approvalToken: string }; result: { revoked: true } };
  'permission.list': { params: { active?: boolean }; result: { grants: unknown[] } };

  'mcp.list': { params: { health?: boolean }; result: { servers: unknown[] } };
  'mcp.add': { params: { name: string; transport: string; command?: string; args?: string[]; url?: string }; result: { serverId: string; status: string } };
  'mcp.remove': { params: { serverId: string }; result: { removed: true } };
  'mcp.health': { params: { serverId?: string }; result: { servers: unknown[] } };
  'mcp.tools': { params: { serverId: string }; result: { tools: unknown[] } };

  'memory.write': { params: { sessionId?: string; category: string; content: string; metadata?: unknown }; result: { memoryId: string } };
  'memory.search': { params: { query: string; k?: number; filter?: unknown }; result: { items: unknown[] } };
  'memory.list': { params: { sessionId?: string; category?: string; limit?: number }; result: { items: unknown[] } };
  'memory.delete': { params: { memoryId: string }; result: { deleted: true } };

  'audit.query': { params: { filter?: unknown; limit?: number; cursor?: string }; result: { items: unknown[]; nextCursor?: string } };
  'audit.export': { params: { filter: unknown; format: string }; result: { url: string; bytes: number } };

  'model.list': { params: { provider?: string }; result: { models: unknown[] } };
  'model.test': { params: { model: string; prompt?: string }; result: { ok: boolean; latencyMs: number; usage?: unknown } };
  'model.cost': { params: { model: string; input: number; output: number }; result: { costUsd: number } };
}

/** 所有可用方法名 */
export type ApiMethodName = keyof ApiMethods;

/** 判断是否为流式方法 */
export function isStreamMethod(method: string): boolean {
  return method === 'agent.run' || method === 'tool.execute';
}

// ════════════════════════════════════════
// OpenCodeClient 实现
// ════════════════════════════════════════
export class OpenCodeClient {
  private subCallbacks = new Map<string, (evt: AppEvent) => void>();
  private readonly requestTimeoutMs: number;

  constructor(
    private readonly transport: TransportClient,
    opts: ClientOpts = {},
  ) {
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30000;
  }

  /** 类型化调用 */
  async call<M extends ApiMethodName>(
    method: M,
    params: ApiMethods[M]['params'],
    opts?: CallOpts,
  ): Promise<ApiMethods[M]['result']> {
    return this.transport.call<ApiMethods[M]['result']>(method, params, {
      timeoutMs: opts?.timeoutMs ?? this.requestTimeoutMs,
      abort: opts?.abort,
    });
  }

  /** 类型化流式调用 */
  async *stream<M extends ApiMethodName>(
    method: M,
    params: ApiMethods[M]['params'],
    opts?: CallOpts,
  ): AsyncIterable<ApiMethods[M] extends { stream: infer S } ? S : never> {
    yield* this.transport.stream(method, params, {
      timeoutMs: opts?.timeoutMs ?? 0, // 流式默认不超时
      abort: opts?.abort,
    }) as AsyncIterable<any>;
  }

  /** 事件订阅 */
  async on(event: string, cb: (evt: AppEvent) => void): Promise<string> {
    const subId = await this.transport.subscribe([event], (n) => cb(n.params as AppEvent));
    this.subCallbacks.set(subId, cb);
    return subId;
  }

  async off(subscriptionId: string): Promise<void> {
    await this.transport.unsubscribe(subscriptionId);
    this.subCallbacks.delete(subscriptionId);
  }

  /** 按过滤器订阅 */
  async subscribe(
    filter: EventFilter,
    cb: (evt: AppEvent) => void,
  ): Promise<string> {
    const events = filter.types ?? ['*'];
    return this.transport.subscribe(events, (n) => {
      const evt = n.params as AppEvent;
      // 客户端侧二次过滤 (sessionId / runId)
      if (filter.sessionId && (evt as { sessionId?: string }).sessionId !== filter.sessionId) return;
      if (filter.runId && (evt as { runId?: string }).runId !== filter.runId) return;
      cb(evt);
    });
  }

  /** 生命周期代理 */
  connect() {
    return this.transport.connect();
  }
  disconnect() {
    return this.transport.disconnect();
  }
  onConnect(cb: () => void) {
    this.transport.onConnect(cb);
  }
  onDisconnect(cb: () => void) {
    this.transport.onDisconnect(cb);
  }
  onError(cb: (err: Error) => void) {
    this.transport.onError(cb);
  }
}
