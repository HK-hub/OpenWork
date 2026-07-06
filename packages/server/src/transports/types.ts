/**
 * Transport 层接口定义
 *
 * 对应 06-详细设计文档 v4.2 §4.4 Transport 层接口
 *      04-架构设计文档 v4.2 §6.3 Transport 适配器设计
 *
 * Transport 层屏蔽底层通信差异,为后端提供统一的 TransportServer,
 * 为前端提供统一的 TransportClient (@opencode/api 中定义)。
 * 所有 Transport 实现 JSON-RPC 2.0 语义,上层不感知传输细节。
 */
import type {
  JsonRpcRequest,
  JsonRpcNotification,
  TransportKind,
} from '@opencode/api';

/** 客户端会话 (连接信息) */
export interface ClientSession {
  id: string;
  transport: TransportKind;
  connectedAt: number;
  subscriptions: Set<string>;
  metadata?: Record<string, unknown>;
}

/** 认证主体 */
export interface AuthPrincipal {
  sub: string; // 用户 ID
  scopes?: string[];
  token?: string;
}

/** 调用上下文 (handler 接收) */
export interface CallContext {
  clientId: string;
  transport: TransportKind;
  auth?: AuthPrincipal;
  cancelSignal: AbortSignal;
  sessionId?: string;
}

/** 方法处理器 */
export type MethodHandler = (
  req: JsonRpcRequest,
  ctx: CallContext,
) => Promise<unknown> | AsyncIterable<unknown>; // AsyncIterable ⇒ 流式

/** TransportServer 接口 (后端用) */
export interface TransportServer {
  readonly kind: TransportKind;
  /** 启动监听 (stdio/embedded 为 no-op) */
  start(opts?: TransportStartOpts): Promise<TransportEndpoint>;
  /** 停止并释放资源 */
  stop(): Promise<void>;
  /** 注册方法处理器 (由 server 宿主装配) */
  handle(method: string, handler: MethodHandler): void;
  /** 注销方法处理器 */
  unhandle(method: string): void;
  /** 向客户端推送通知 / 事件 */
  notify(clientId: string, method: string, params: unknown): void;
  /** 向客户端推送流式分片 */
  stream(clientId: string, id: string | number, chunk: unknown): void;
  /** 向所有客户端广播 */
  broadcast(method: string, params: unknown): void;
  /** 获取已连接客户端 */
  getClients(): ClientSession[];
  /** 连接生命周期事件 */
  onConnect(cb: (client: ClientSession) => void): void;
  onDisconnect(cb: (client: ClientSession) => void): void;
}

export interface TransportStartOpts {
  port?: number;
  host?: string;
}

export interface TransportEndpoint {
  address: string;
  port?: number;
  kind: TransportKind;
}

/** 判断 handler 是否为流式 (返回 AsyncIterable) */
export function isStreamHandler(handler: MethodHandler): boolean {
  // 简单判断: 流式方法名集合 (与 @opencode/api isStreamMethod 对齐)
  return false; // 实际由 router 判断方法名
}

/** 流式方法集合 */
export const STREAM_METHODS = new Set<string>(['agent.run', 'tool.execute']);
