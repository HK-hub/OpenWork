/**
 * MCP / Memory / Audit / Model 域 handlers
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine, Database } from '@opencode/core';
import { AuditRepository, MemoryRepository } from '@opencode/core';
import { RpcException } from '@opencode/api';
import { MODEL_PRICING, getModelPricing, calculateCost } from '@opencode/core';

export function registerMcpHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  core: CoreEngine,
): void {
  const mcp = core.mcpClient;

  router.register('mcp.list', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    return { servers: mcp.listServers() };
  });

  router.register('mcp.add', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as {
      name: string;
      transport: 'stdio' | 'sse' | 'http';
      command?: string;
      args?: string[];
      url?: string;
    };
    if (!params.name || !params.transport) throw new RpcException(-32602, 'name, transport required');
    return mcp.addServer(params);
  });

  router.register('mcp.remove', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { serverId: string };
    if (!params.serverId) throw new RpcException(-32602, 'serverId required');
    await mcp.removeServer(params.serverId);
    return { removed: true as const };
  });

  router.register('mcp.health', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { serverId?: string };
    return { servers: await mcp.healthCheck(params.serverId) };
  });

  router.register('mcp.tools', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { serverId: string };
    if (!params.serverId) throw new RpcException(-32602, 'serverId required');
    return { tools: await mcp.listTools(params.serverId) };
  });
}

export function registerMemoryHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  db: Database | null,
): void {
  const memRepo = db ? new MemoryRepository(db) : null;

  router.register('memory.write', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!memRepo) throw new RpcException(-32103, 'Database not available');
    const params = (req.params ?? {}) as {
      sessionId?: string;
      category: string;
      content: string;
      metadata?: unknown;
    };
    if (!params.category || !params.content) throw new RpcException(-32602, 'category, content required');
    const memory = memRepo.create({
      sessionId: params.sessionId,
      category: params.category as 'preference' | 'fact' | 'skill' | 'episode' | 'procedure' | 'context',
      content: params.content,
      metadata: params.metadata as Record<string, unknown> | undefined,
    });
    return { memoryId: memory.id };
  });

  router.register('memory.search', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!memRepo) return { items: [] };
    const params = (req.params ?? {}) as { query: string; k?: number; filter?: { sessionId?: string; category?: string } };
    if (!params.query) throw new RpcException(-32602, 'query required');
    // v0.1: 简单 LIKE 搜索 (v0.2+ 接入向量检索)
    const items = memRepo.search(params.query, params.k ?? 5, params.filter);
    return { items: items.map((m) => ({ memory: m, score: 1.0 })) };
  });

  router.register('memory.list', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!memRepo) return { items: [] };
    const params = (req.params ?? {}) as { sessionId?: string; category?: string; limit?: number };
    const items = memRepo.list({
      sessionId: params.sessionId,
      category: params.category,
      limit: params.limit,
    });
    return { items };
  });

  router.register('memory.delete', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!memRepo) throw new RpcException(-32103, 'Database not available');
    const params = (req.params ?? {}) as { memoryId: string };
    if (!params.memoryId) throw new RpcException(-32602, 'memoryId required');
    memRepo.delete(params.memoryId);
    return { deleted: true as const };
  });
}

export function registerAuditHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  db: Database | null,
): void {
  const auditRepo = db ? new AuditRepository(db) : null;

  router.register('audit.query', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!auditRepo) return { items: [], nextCursor: undefined };
    const params = (req.params ?? {}) as { filter?: Record<string, unknown>; limit?: number };
    const items = auditRepo.query({
      actor: params.filter?.actor as string | undefined,
      action: params.filter?.action as string | undefined,
      resource: params.filter?.resource as string | undefined,
      sessionId: params.filter?.sessionId as string | undefined,
      from: params.filter?.from as number | undefined,
      to: params.filter?.to as number | undefined,
      limit: params.limit ?? 100,
    });
    return { items, nextCursor: undefined };
  });

  router.register('audit.export', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { filter: unknown; format: string };
    return { url: `opencode://audit/export.${params.format}`, bytes: 0 };
  });
}

export function registerModelHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
): void {
  router.register('model.list', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    const models = Object.keys(MODEL_PRICING).map((name) => {
      const pricing = MODEL_PRICING[name]!;
      return {
        provider: name.startsWith('claude') ? 'anthropic' : name.startsWith('gpt') ? 'openai' : 'unknown',
        name,
        contextWindow: 200000,
        inputPricePer1k: pricing.inputPer1k,
        outputPricePer1k: pricing.outputPer1k,
      };
    });
    return { models };
  });

  router.register('model.test', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { model: string; prompt?: string };
    return { ok: true, latencyMs: 0, usage: { input: 0, output: 0 } };
  });

  router.register('model.cost', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { model: string; input: number; output: number };
    const pricing = getModelPricing(params.model);
    return { costUsd: calculateCost(params.input, params.output, pricing) };
  });
}
