/**
 * JSON-RPC 2.0 协议定义
 * @see https://www.jsonrpc.org/specification
 *
 * 前后端共享，由 @opencode/api 包导出，所有 Transport 实现必须遵循此契约。
 */

export const JSONRPC_VERSION = '2.0' as const;

/** JSON-RPC 请求 ID 类型 */
export type RpcId = string | number | null;

/** JSON-RPC 2.0 请求 */
export interface JsonRpcRequest<P = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId; // null 表示 Notification
  method: string;
  params?: P;
}

/** JSON-RPC 2.0 响应 */
export interface JsonRpcResponse<R = unknown> {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RpcId;
  result?: R;
  error?: JsonRpcError;
}

/** JSON-RPC 错误对象 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** 通知 (id 为 null, 无响应) */
export type JsonRpcNotification<P = unknown> = JsonRpcRequest<P> & { id: null };

/** 批量请求 */
export type JsonRpcBatchRequest<P = unknown> = JsonRpcRequest<P>[];

/** 流式分片标记 (chunk/end) */
export type StreamMarker = 'chunk' | 'end';

/** 流式响应分片 */
export interface StreamChunk<T = unknown> {
  stream: 'chunk';
  delta?: T;
}

/** 流式响应结束 */
export interface StreamEnd<T = unknown> {
  stream: 'end';
  result?: T;
}

/** 取消通知方法名 */
export const CANCEL_METHOD = '$/cancel';

/** 取消通知参数 */
export interface CancelParams {
  id: RpcId;
}

/** 构造 JSON-RPC 错误响应 */
export function rpcError(
  id: RpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return { jsonrpc: JSONRPC_VERSION, id, error: { code, message, data } };
}

/** 构造 JSON-RPC 成功响应 */
export function rpcResult<R>(id: RpcId, result: R): JsonRpcResponse<R> {
  return { jsonrpc: JSONRPC_VERSION, id, result };
}

/** 判断是否为通知 (id === null) */
export function isNotification(req: JsonRpcRequest): req is JsonRpcNotification {
  return req.id === null;
}

/** 判断是否为批量请求 */
export function isBatch(req: unknown): req is JsonRpcRequest[] {
  return Array.isArray(req) && req.length > 0;
}
