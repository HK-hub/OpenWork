/**
 * JSON-RPC Router — 方法分发
 *
 * 对应 04-架构设计文档 v4.2 §6.2 JSON-RPC 方法分发
 *      06-详细设计文档 v4.2 §4.2 API 方法清单
 *
 * 注册各域的 handler,提供:
 *  - 方法分发 (按 method 名查找 handler)
 *  - 参数 Zod 校验 (可选)
 *  - 流式方法识别
 *  - 未知方法返回 -32601
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from './transports/types.js';
import { STREAM_METHODS } from './transports/types.js';
import { moduleLogger } from '@opencode/core';
import { RpcException, METHOD_NOT_FOUND } from '@opencode/api';

const log = moduleLogger('Router');

export class Router {
  private handlers = new Map<string, MethodHandler>();

  /** 注册方法 handler */
  register(method: string, handler: MethodHandler): void {
    if (this.handlers.has(method)) {
      log.warn('overriding existing handler', { method });
    }
    this.handlers.set(method, handler);
    log.debug('handler registered', { method, isStream: this.isStreamMethod(method) });
  }

  /** 注销方法 */
  unregister(method: string): void {
    this.handlers.delete(method);
  }

  /** 获取 handler */
  get(method: string): MethodHandler | undefined {
    return this.handlers.get(method);
  }

  /** 判断方法是否为流式 */
  isStreamMethod(method: string): boolean {
    return STREAM_METHODS.has(method);
  }

  /** 列出所有已注册方法 */
  listMethods(): string[] {
    return Array.from(this.handlers.keys());
  }

  /** 调用方法 (供 Transport 调用) */
  async invoke(req: JsonRpcRequest, ctx: CallContext): Promise<unknown> {
    const handler = this.handlers.get(req.method);
    if (!handler) {
      throw new RpcException(METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
    log.debug('invoke', { method: req.method, id: req.id, isStream: this.isStreamMethod(req.method) });
    return handler(req, ctx);
  }

  /** 批量调用 */
  async invokeBatch(reqs: JsonRpcRequest[], ctx: CallContext): Promise<unknown[]> {
    return Promise.all(reqs.map((r) => this.invoke(r, ctx).catch((err) => ({ error: err }))));
  }
}
