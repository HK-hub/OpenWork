/**
 * ToolRegistry — 工具注册中心
 *
 * 对应 06-详细设计文档 v4.2 §3.4 ToolRegistry + ToolDispatcher
 *      04-架构设计文档 v4.2 §9.2 Tool Registry
 */
import type { ToolDef, ToolResult, RiskLevel, JsonSchema, ID } from '@opencode/api';
import { genToolCallId } from '../utils/id-generator.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('ToolRegistry');

/** 工具执行函数签名 */
export type ToolHandler = (
  args: Record<string, unknown>,
  ctx: ToolCallContext,
) => Promise<ToolResult> | AsyncIterable<ToolResult>;

/** 工具调用上下文 */
export interface ToolCallContext {
  toolCallId: ID;
  sessionId?: ID;
  messageId?: ID;
  abortSignal: AbortSignal;
}

/** 注册的工具条目 */
interface RegisteredTool {
  def: ToolDef;
  handler: ToolHandler;
}

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  /** 注册工具 */
  register(def: ToolDef, handler: ToolHandler): void {
    if (this.tools.has(def.name)) {
      log.warn('tool already registered, overriding', { name: def.name });
    }
    this.tools.set(def.name, { def, handler });
    log.debug('tool registered', { name: def.name, source: def.source, riskLevel: def.riskLevel });
  }

  /** 取消注册 */
  unregister(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) log.debug('tool unregistered', { name });
    return result;
  }

  /** 获取工具定义 */
  get(name: string): ToolDef | undefined {
    return this.tools.get(name)?.def;
  }

  /** 检查是否存在 */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** 列出所有工具 */
  list(filter?: { category?: string; enabled?: boolean }): ToolDef[] {
    let defs = Array.from(this.tools.values()).map((t) => t.def);
    if (filter?.category) defs = defs.filter((d) => d.category === filter.category);
    if (filter?.enabled !== undefined) defs = defs.filter((d) => d.enabled === filter.enabled);
    return defs;
  }

  /** 执行工具 (同步,无审批逻辑;审批由 PermissionGateway 处理) */
  async execute(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolCallContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw Object.assign(new Error(`Tool not found: ${name}`), { code: -32600 });
    }
    if (!tool.def.enabled) {
      throw Object.assign(new Error(`Tool disabled: ${name}`), { code: -32103 });
    }
    const start = Date.now();
    log.debug('tool executing', { name, toolCallId: ctx.toolCallId });
    try {
      const result = await tool.handler(args, ctx);
      // ToolHandler 可返回 Promise<ToolResult> 或 AsyncIterable<ToolResult>
      // 流式工具: 收集所有 chunk 并返回最后一个 (v0.1 简化处理)
      if (
        result &&
        typeof result === 'object' &&
        typeof (result as AsyncIterable<ToolResult>)[Symbol.asyncIterator] === 'function'
      ) {
        let last: ToolResult | undefined;
        for await (const chunk of result as AsyncIterable<ToolResult>) {
          last = chunk;
        }
        if (!last) {
          throw Object.assign(new Error(`Tool ${name} returned empty stream`), { code: -32611 });
        }
        log.debug('tool executed (stream)', {
          name,
          toolCallId: ctx.toolCallId,
          durationMs: Date.now() - start,
        });
        return last;
      }
      log.debug('tool executed', {
        name,
        toolCallId: ctx.toolCallId,
        durationMs: Date.now() - start,
      });
      return result as ToolResult;
    } catch (err) {
      log.error('tool execution failed', {
        name,
        toolCallId: ctx.toolCallId,
        error: (err as Error).message,
      });
      throw err;
    }
  }

  /** 清空所有工具 */
  clear(): void {
    this.tools.clear();
  }
}

/** 简单工具定义构造器 */
export function defineTool(opts: {
  name: string;
  description: string;
  source?: ToolDef['source'];
  sourceId?: string;
  parametersSchema: JsonSchema;
  riskLevel: RiskLevel;
  requiresApproval?: boolean;
  category?: string;
  handler: ToolHandler;
}): { def: ToolDef; handler: ToolHandler } {
  return {
    def: {
      name: opts.name,
      description: opts.description,
      source: opts.source ?? 'builtin',
      sourceId: opts.sourceId,
      parametersSchema: opts.parametersSchema,
      riskLevel: opts.riskLevel,
      requiresApproval: opts.requiresApproval ?? opts.riskLevel !== 'L0',
      enabled: true,
      category: opts.category,
    },
    handler: opts.handler,
  };
}
