/**
 * Session 域 handlers
 *
 * 对应 @opencode/api SessionDomain (session.create / list / get / delete / export / fork)
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import { SessionRepository, ProjectRepository } from '@opencode/core';
import type { Database } from '@opencode/core';
import { RpcException, NOT_FOUND, INVALID_PARAMS } from '@opencode/api';
import { moduleLogger } from '@opencode/core';

const log = moduleLogger('SessionHandlers');

export function registerSessionHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  db: Database,
): void {
  const sessions = new SessionRepository(db);
  const projects = new ProjectRepository(db);

  // session.create
  router.register('session.create', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { projectId: string; title?: string; mode?: string };
    if (!params.projectId) throw new RpcException(INVALID_PARAMS, 'projectId required');
    // 检查 project 存在
    if (!projects.findById(params.projectId)) {
      throw new RpcException(NOT_FOUND, `Project not found: ${params.projectId}`);
    }
    const session = sessions.create({
      projectId: params.projectId,
      title: params.title,
      mode: params.mode as 'ask' | 'plan' | 'build' | 'review' | undefined,
    });
    log.info('session created', { sessionId: session.id, projectId: params.projectId });
    return { sessionId: session.id, createdAt: session.createdAt };
  });

  // session.list
  router.register('session.list', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { projectId?: string; limit?: number; cursor?: string };
    const limit = Math.min(params.limit ?? 50, 100);
    if (params.projectId) {
      const items = sessions.listByProject(params.projectId, limit);
      return { items, nextCursor: undefined };
    }
    const items = sessions.listActive(limit);
    return { items, nextCursor: undefined };
  });

  // session.get
  router.register('session.get', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { sessionId: string };
    if (!params.sessionId) throw new RpcException(INVALID_PARAMS, 'sessionId required');
    const session = sessions.findById(params.sessionId);
    if (!session) throw new RpcException(NOT_FOUND, `Session not found: ${params.sessionId}`);
    return { session, messages: [], stats: {
      messageCount: session.messageCount,
      stepCount: session.stepCount,
      toolCallCount: session.toolCallCount,
      tokenTotalIn: session.tokenTotalIn,
      tokenTotalOut: session.tokenTotalOut,
      costTotalUsd: session.costTotalUsd,
    } };
  });

  // session.delete
  router.register('session.delete', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { sessionId: string };
    if (!params.sessionId) throw new RpcException(INVALID_PARAMS, 'sessionId required');
    const ok = sessions.delete(params.sessionId);
    if (!ok) throw new RpcException(NOT_FOUND, `Session not found: ${params.sessionId}`);
    return { deleted: true as const };
  });

  // session.export (v0.1 stub: 仅返回元数据)
  router.register('session.export', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { sessionId: string; format?: string };
    if (!params.sessionId) throw new RpcException(INVALID_PARAMS, 'sessionId required');
    log.info('session.export (stub)', { sessionId: params.sessionId, format: params.format });
    return { url: `opencode://sessions/${params.sessionId}.${params.format ?? 'json'}`, bytes: 0 };
  });

  // session.fork (v0.1 stub)
  router.register('session.fork', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { sessionId: string; fromMessageId?: string };
    if (!params.sessionId) throw new RpcException(INVALID_PARAMS, 'sessionId required');
    const session = sessions.findById(params.sessionId);
    if (!session) throw new RpcException(NOT_FOUND, `Session not found: ${params.sessionId}`);
    const forked = sessions.create({
      projectId: session.projectId,
      title: `Fork of ${session.title ?? session.id}`,
      mode: session.mode,
      parentSessionId: session.id,
      parentStepId: params.fromMessageId,
    });
    return { newSessionId: forked.id };
  });
}
