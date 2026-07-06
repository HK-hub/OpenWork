/**
 * LoopEngine — Agent PAOR 主循环
 *
 * Phase 1.3 实现:
 *   perceive (组装上下文) → act (LLM 推理 + tool_calls) → observe (执行工具 + 收集结果)
 *   → 循环直至 LLM 不再请求工具调用,或达到 maxIterations / budget 上限
 *
 * 对应 06-详细设计文档 v4.2 §3.1 LoopEngine (PAOR 主循环)
 *      06-详细设计文档 v4.2 §3.4 ToolDispatcher.execute (7 步流程)
 *      04-架构设计文档 v4.2 §8.5.4 工具调用流程
 */
import type { IAgentLoop, AgentEvent, RunContext, LoopStepResult, ModelCallRequest, ModelCallChunk } from './types.js';
import type { ID, TaskInput, ToolDef, ToolResult } from '@opencode/api';
import type { ToolRegistry, ToolCallContext } from '../tools/registry.js';
import type { PermissionGateway } from '../permission/gateway.js';
import type { ProviderToolDef } from '../providers/types.js';
import { moduleLogger } from '../utils/logger.js';
import { getEventBus } from '../events/event-bus.js';
import { genRunId, genStepId, genMessageId, genToolCallId } from '../utils/id-generator.js';

const log = moduleLogger('LoopEngine');

export interface LoopEngineOptions {
  toolRegistry: ToolRegistry;
  permissionGateway: PermissionGateway;
  /**
   * 模型调用函数 (由 ProviderRouter.stream 注入)。
   * 接收 ModelCallRequest 返回 ModelCallChunk 流,LoopEngine 透传 delta 给前端。
   */
  callModel?: (req: ModelCallRequest) => AsyncIterable<ModelCallChunk>;
  /** 当前使用的模型 ID (从 config 注入,运行时可被覆盖) */
  defaultModel?: string;
  /** 默认 Provider (从 config 注入) */
  defaultProvider?: string;
  /** 最大迭代次数 */
  maxIterations?: number;
}

/** 一次工具调用的累积状态 (在 act 阶段从 stream 收集) */
interface ToolCallAccumulated {
  id: string;
  name: string;
  args: unknown;
}

/** observe 阶段单工具的执行结果 */
interface ToolExecResult {
  toolCallId: string;
  toolName: string;
  args: unknown;
  result: ToolResult | null;
  error?: string;
  durationMs: number;
  /** 'allowed' | 'denied' | 'failed' | 'not_found' */
  status: string;
}

/**
 * LoopEngine — Phase 1.3 完整 PAOR 实现
 *
 * 主循环流程:
 *   1. perceive: 组装 system prompt + 初始 messages + 可用 tools 列表
 *   2. act: 调用 LLM,流式收集 delta + tool_calls
 *   3. 若 LLM 未请求工具调用 → 返回最终文本,完成
 *   4. observe: 对每个 tool_call:
 *      a. PermissionGateway.check('tool.execute', toolName, riskLevel)
 *      b. allow → ToolRegistry.execute(name, args, ctx)
 *      c. ask/deny → 构造拒绝结果 (v0.1 无 HITL UI,deny L2/L3 默认)
 *   5. 把工具结果追加为 'tool' 角色消息,回到步骤 2
 *   6. 达到 maxIterations 或 budget 上限时停止
 */
export class LoopEngine implements IAgentLoop {
  private runs = new Map<ID, RunContext>();

  constructor(private opts: LoopEngineOptions) {
    log.info('LoopEngine initialized (Phase 1.3 PAOR)', {
      maxIterations: opts.maxIterations ?? 25,
      hasCallModel: !!opts.callModel,
      hasToolRegistry: !!opts.toolRegistry,
    });
  }

  async *run(input: TaskInput): AsyncIterable<AgentEvent> {
    const runId = genRunId();
    const maxIter = input.budget?.maxIterations ?? this.opts.maxIterations ?? 25;
    const hardCapUsd = input.budget?.hardCapUsd ?? 10;
    const ctx: RunContext = {
      runId,
      sessionId: input.sessionId,
      prompt: input.prompt,
      mode: input.mode ?? 'build',
      status: 'running',
      startedAt: Date.now(),
      currentStep: 0,
      currentIteration: 0,
      currentPhase: 'perceive',
      abortController: new AbortController(),
      budget: { hardCapUsd, maxIterations: maxIter },
      usage: { input: 0, output: 0, costUsd: 0 },
    };
    this.runs.set(runId, ctx);

    const bus = getEventBus();
    const startedEvent: AgentEvent = {
      type: 'started',
      runId,
      sessionId: input.sessionId,
      timestamp: Date.now(),
    };
    bus.emit({
      type: 'agent.started',
      sessionId: input.sessionId,
      runId,
      prompt: input.prompt,
      mode: ctx.mode,
      timestamp: startedEvent.timestamp,
    });
    yield startedEvent;

    try {
      if (!this.opts.callModel) {
        // 占位响应: 未接入模型时
        const placeholder = `[LoopEngine v0.1 placeholder] 模型 Provider 未注入,收到 prompt: ${input.prompt.slice(0, 100)}`;
        yield {
          type: 'message',
          runId,
          messageId: genMessageId(),
          delta: placeholder,
          finishReason: 'stop',
          timestamp: Date.now(),
        };
        ctx.finalText = placeholder;
      } else {
        // ════════════════════════════════════════
        // Phase 1: perceive — 组装初始上下文
        // ════════════════════════════════════════
        ctx.currentPhase = 'perceive';
        const modelId = input.model ?? this.opts.defaultModel ?? 'doubao-seed-2.0-code';
        const providerId = input.provider ?? this.opts.defaultProvider ?? 'volcengine';
        const systemPrompt = this.buildSystemPrompt(input);
        const messages: ModelCallRequest['prompt']['messages'] = [
          { role: 'user', content: input.prompt },
        ];
        // 获取可用工具列表 (从 ToolRegistry) — Phase 1.3 注入
        const availableTools = this.opts.toolRegistry.list({ enabled: true });
        const toolsForProvider = this.convertToolsForProvider(availableTools);

        let finalText = '';

        // ════════════════════════════════════════
        // Phase 2-3: act ↔ observe 主循环
        // ════════════════════════════════════════
        for (ctx.currentIteration = 1; ctx.currentIteration <= maxIter; ctx.currentIteration++) {
          // 检查取消
          if (ctx.abortController.signal.aborted) {
            log.info('run aborted by user', { runId, iteration: ctx.currentIteration });
            break;
          }
          // 检查预算
          if (ctx.usage.costUsd >= hardCapUsd) {
            log.warn('budget hard cap exceeded, stopping', { runId, costUsd: ctx.usage.costUsd, hardCapUsd });
            finalText += `\n\n[Budget limit reached: $${ctx.usage.costUsd.toFixed(4)} / $${hardCapUsd}]`;
            break;
          }

          // ── act: 调用 LLM ──
          ctx.currentPhase = 'act';
          ctx.currentStep += 1;

          const modelReq: ModelCallRequest = {
            prompt: {
              system: systemPrompt,
              messages: [...messages],
            },
            model: modelId,
            provider: providerId,
            params: input.params ?? { temperature: 0, maxTokens: 8192 },
            stream: true,
            tools: toolsForProvider.length > 0 ? toolsForProvider : undefined,
          };

          const messageId = genMessageId();

          // 发射 loop 事件 (act 开始)
          yield {
            type: 'loop',
            runId,
            step: ctx.currentStep,
            iteration: ctx.currentIteration,
            phase: 'act',
            timestamp: Date.now(),
          };

          log.info('act: calling model', {
            runId,
            iteration: ctx.currentIteration,
            model: modelReq.model,
            messageCount: messages.length,
            toolCount: toolsForProvider.length,
          });

          const toolCallAccum: ToolCallAccumulated[] = [];
          let assistantText = '';
          let finishReason = 'stop';

          for await (const chunk of this.opts.callModel(modelReq)) {
            if (chunk.delta) {
              assistantText += chunk.delta;
              finalText += chunk.delta;
              yield {
                type: 'message',
                runId,
                messageId,
                delta: chunk.delta,
                timestamp: Date.now(),
              };
            }
            if (chunk.toolCall) {
              toolCallAccum.push({
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                args: chunk.toolCall.args,
              });
            }
            if (chunk.finishReason) {
              finishReason = chunk.finishReason;
            }
            if (chunk.usage) {
              ctx.usage.input += chunk.usage.input;
              ctx.usage.output += chunk.usage.output;
            }
          }

          // 累计成本
          ctx.usage.costUsd = this.estimateCost(modelReq.model, ctx.usage.input, ctx.usage.output);

          // 发送 message 终止信号 (本轮 LLM 输出完成)
          yield {
            type: 'message',
            runId,
            messageId,
            finishReason,
            timestamp: Date.now(),
          };

          log.info('act: completed', {
            runId,
            iteration: ctx.currentIteration,
            textLength: assistantText.length,
            toolCalls: toolCallAccum.length,
            finishReason,
            inputTokens: ctx.usage.input,
            outputTokens: ctx.usage.output,
            costUsd: ctx.usage.costUsd,
          });

          // 若 LLM 没有请求工具调用,则主循环结束
          if (toolCallAccum.length === 0) {
            log.info('no tool_calls requested, finishing', { runId, iteration: ctx.currentIteration });
            break;
          }

          // 把本轮 assistant 消息 (含工具调用) 追加到 messages
          // 重要: assistant 消息必须带 tool_calls,否则下一轮 LLM 无法关联 tool 结果
          messages.push({
            role: 'assistant',
            content: assistantText,
            toolCalls: toolCallAccum.map((tc) => ({
              id: tc.id,
              name: tc.name,
              args: tc.args,
            })),
          });

          // ── observe: 执行工具 ──
          ctx.currentPhase = 'observe';
          yield {
            type: 'loop',
            runId,
            step: ctx.currentStep,
            iteration: ctx.currentIteration,
            phase: 'observe',
            timestamp: Date.now(),
          };

          // 先发射所有 tool_call 事件 (前端可展示"正在调用工具...")
          for (const tc of toolCallAccum) {
            yield {
              type: 'tool_call',
              runId,
              toolCallId: tc.id,
              toolName: tc.name,
              args: tc.args,
              timestamp: Date.now(),
            };
          }

          // 执行工具并收集结果
          const observeResults = await this.observePhase(toolCallAccum, ctx, runId);

          // 发射 tool_result 事件
          for (const result of observeResults) {
            yield {
              type: 'tool_result',
              runId,
              toolCallId: result.toolCallId,
              status: result.status,
              durationMs: result.durationMs,
              timestamp: Date.now(),
            };
          }

          // 把工具结果追加为 'tool' 角色消息 (供下一轮 LLM 调用作为上下文)
          // 重要: 每条 tool 消息必须带 toolCallId,以关联到 assistant.toolCalls[i].id
          for (const result of observeResults) {
            const toolResultContent = this.formatToolResultForLLM(result);
            messages.push({
              role: 'tool',
              content: toolResultContent,
              toolCallId: result.toolCallId,
            });
          }

          // 若所有工具调用都被拒绝,且 assistant 没有输出文本,
          // 追加一条用户提示,引导 LLM 在下一轮给出回应
          if (
            observeResults.length > 0 &&
            observeResults.every((r) => r.status === 'denied') &&
            assistantText.trim() === ''
          ) {
            messages.push({
              role: 'user',
              content: '[System] All tool calls were denied. Please respond directly to the user without further tool calls, or explain what you needed the tools for.',
            });
          }

          ctx.currentStep += 1;
        }

        // 达到 maxIterations 时附加提示
        if (ctx.currentIteration > maxIter) {
          log.warn('max iterations reached', { runId, maxIter });
          finalText += `\n\n[Reached max iterations: ${maxIter}]`;
        }

        ctx.finalText = finalText;
      }

      // ════════════════════════════════════════
      // 完成事件
      // ════════════════════════════════════════
      const completedEvent: AgentEvent = {
        type: 'completed',
        runId,
        status: 'completed',
        usage: ctx.usage,
        finalText: ctx.finalText,
        timestamp: Date.now(),
      };
      ctx.status = 'completed';
      ctx.completedAt = Date.now();
      bus.emit({
        type: 'agent.completed',
        sessionId: input.sessionId,
        runId,
        status: 'completed',
        usage: ctx.usage,
        timestamp: completedEvent.timestamp,
      });
      yield completedEvent;
    } catch (err) {
      ctx.status = 'error';
      const errorMsg = (err as Error).message;
      log.error('run failed', { runId, error: errorMsg, iteration: ctx.currentIteration });
      const errorEvent: AgentEvent = {
        type: 'error',
        runId,
        error: errorMsg,
        timestamp: Date.now(),
      };
      bus.emit({
        type: 'agent.completed',
        sessionId: input.sessionId,
        runId,
        status: 'error',
        usage: ctx.usage,
        timestamp: errorEvent.timestamp,
      });
      yield errorEvent;
    } finally {
      this.runs.delete(runId);
    }
  }

  /**
   * observe 阶段: 批量执行工具调用,返回每个调用的结果
   *
   * 流程 (对应 06-详细设计文档 v4.2 §3.4 ToolDispatcher.execute):
   *   1. 查找工具 (registry.get)
   *   2. 权限检查 (permissionGateway.check)
   *   3. allow → ToolRegistry.execute
   *      ask/deny → 构造拒绝结果 (v0.1 简化: 不实现 HITL UI,L2/L3 默认拒绝)
   *
   * 事件发射 (tool_call / tool_result) 由调用方 (run 方法) 处理,
   * 此方法仅返回执行结果数组,职责单一。
   */
  private async observePhase(
    toolCalls: ToolCallAccumulated[],
    ctx: RunContext,
    _runId: ID,
  ): Promise<ToolExecResult[]> {
    const results: ToolExecResult[] = [];

    for (const tc of toolCalls) {
      const toolCallId = tc.id || genToolCallId();
      const result = await this.executeSingleTool(tc, toolCallId, ctx);
      results.push(result);

      log.info('observe: tool executed', {
        toolName: tc.name,
        toolCallId,
        status: result.status,
        durationMs: result.durationMs,
      });
    }

    return results;
  }

  /**
   * 执行单个工具调用 (内部辅助)
   */
  private async executeSingleTool(
    tc: ToolCallAccumulated,
    toolCallId: string,
    ctx: RunContext,
  ): Promise<ToolExecResult> {
    const start = Date.now();

    // 1. 查找工具
    const toolDef = this.opts.toolRegistry.get(tc.name);
    if (!toolDef) {
      return {
        toolCallId,
        toolName: tc.name,
        args: tc.args,
        result: null,
        error: `Tool not found: ${tc.name}`,
        durationMs: Date.now() - start,
        status: 'not_found',
      };
    }

    // 2. 权限检查 (同步)
    const riskLevel = toolDef.riskLevel;
    const decision = this.opts.permissionGateway.check('tool.execute', tc.name, riskLevel);

    if (decision === 'deny') {
      return {
        toolCallId,
        toolName: tc.name,
        args: tc.args,
        result: null,
        error: `Permission denied by rule (L${riskLevel.replace('L', '')})`,
        durationMs: Date.now() - start,
        status: 'denied',
      };
    }

    if (decision === 'ask') {
      // v0.1 简化: HITL 审批 UI 未实现,L2/L3 默认拒绝
      // Phase 2+ 实现: 通过 EventBus 发 permission.requested 事件,等待 UI grant
      log.warn('tool requires approval (HITL not yet implemented, denying)', {
        toolName: tc.name,
        riskLevel,
      });
      return {
        toolCallId,
        toolName: tc.name,
        args: tc.args,
        result: null,
        error: `Tool '${tc.name}' (L${riskLevel.replace('L', '')}) requires user approval. Approval UI not yet implemented in v0.1 — please add a permission rule to allow this tool, or use lower-risk tools.`,
        durationMs: Date.now() - start,
        status: 'denied',
      };
    }

    // 3. 执行工具
    try {
      const toolCtx: ToolCallContext = {
        toolCallId,
        sessionId: ctx.sessionId,
        abortSignal: ctx.abortController.signal,
      };
      const argsRecord = (tc.args && typeof tc.args === 'object'
        ? (tc.args as Record<string, unknown>)
        : { _value: tc.args });
      const result = await this.opts.toolRegistry.execute(tc.name, argsRecord, toolCtx);
      return {
        toolCallId,
        toolName: tc.name,
        args: tc.args,
        result,
        durationMs: Date.now() - start,
        status: 'allowed',
      };
    } catch (err) {
      return {
        toolCallId,
        toolName: tc.name,
        args: tc.args,
        result: null,
        error: (err as Error).message,
        durationMs: Date.now() - start,
        status: 'failed',
      };
    }
  }

  async stop(runId: ID, reason?: string): Promise<void> {
    const ctx = this.runs.get(runId);
    if (!ctx) {
      log.warn('stop: run not found', { runId });
      return;
    }
    ctx.abortController.abort();
    ctx.status = 'stopped';
    log.info('run stopped', { runId, reason });
  }

  async pause(runId: ID): Promise<{ checkpointId: ID }> {
    const ctx = this.runs.get(runId);
    if (!ctx) throw new Error(`run not found: ${runId}`);
    ctx.status = 'paused';
    ctx.pausedAt = Date.now();
    // v0.1 占位: 实际检查点持久化在 Phase 3 实现
    return { checkpointId: genStepId() };
  }

  async resume(runId: ID): Promise<void> {
    const ctx = this.runs.get(runId);
    if (!ctx) throw new Error(`run not found: ${runId}`);
    if (ctx.status !== 'paused') throw new Error(`run not paused: ${runId}`);
    ctx.status = 'running';
    ctx.pausedAt = undefined;
  }

  async step(runId: ID, kind: 'next' | 'over' | 'into'): Promise<LoopStepResult> {
    const ctx = this.runs.get(runId);
    if (!ctx) throw new Error(`run not found: ${runId}`);
    // v0.1 占位: 单步执行在 v0.2 完整实现
    return {
      stepId: genStepId(),
      step: ctx.currentStep,
      iteration: ctx.currentIteration,
      phase: ctx.currentPhase,
      action: `step:${kind}`,
      status: 'success',
      durationMs: 0,
    };
  }

  inspect(runId: ID): RunContext | undefined {
    return this.runs.get(runId);
  }

  /** 获取所有活跃运行 */
  getActiveRuns(): RunContext[] {
    return Array.from(this.runs.values()).filter((r) => r.status === 'running');
  }

  // ════════════════════════════════════════
  // 内部辅助
  // ════════════════════════════════════════

  /** 构造 System Prompt (Phase 1.3 完善: 包含工具列表与工作模式说明) */
  private buildSystemPrompt(input: TaskInput): string {
    const parts: string[] = [
      'You are OpenCoding Agent, an AI coding assistant integrated into a desktop IDE.',
      `Current agent mode: ${input.mode ?? 'build'}`,
    ];
    if (input.tools && input.tools.length > 0) {
      parts.push(`User-requested tools: ${input.tools.join(', ')}`);
    }
    const availableTools = this.opts.toolRegistry.list({ enabled: true });
    if (availableTools.length > 0) {
      const toolList = availableTools
        .map((t) => `- ${t.name} (${t.riskLevel}): ${t.description}`)
        .join('\n');
      parts.push(`Available tools:\n${toolList}`);
      parts.push(
        'When you need to perform file operations or run commands, use the appropriate tool. ' +
          'For read-only operations (L0), they will be auto-approved. ' +
          'For mutating operations (L1), they may be auto-approved based on config. ' +
          'For destructive operations (L2/L3), user approval is required (currently denied in v0.1 unless a permission rule is added).',
      );
    }
    parts.push('Respond concisely and use tools when needed.');
    return parts.join('\n\n');
  }

  /** 把 ToolDef[] 转换为 Provider 通用 ToolDef 格式 (OpenAI function calling 风格) */
  private convertToolsForProvider(toolDefs: ToolDef[]): ProviderToolDef[] {
    return toolDefs.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parametersSchema as unknown as Record<string, unknown>,
      },
    }));
  }

  /** 把工具执行结果格式化为 'tool' 角色消息的 content 字符串 */
  private formatToolResultForLLM(result: ToolExecResult): string {
    if (result.status === 'denied' || result.status === 'not_found' || result.status === 'failed') {
      return JSON.stringify({
        toolCallId: result.toolCallId,
        toolName: result.toolName,
        status: result.status,
        error: result.error,
      });
    }
    return JSON.stringify({
      toolCallId: result.toolCallId,
      toolName: result.toolName,
      status: 'success',
      output: result.result?.output,
    });
  }

  /**
   * 估算 USD 成本 (v0.1 简化: 内置主流模型定价,未知模型返回 0)
   * 注: Phase 2+ 改为从 ProviderRouter 拉取 ModelInfo 中的定价
   *
   * 火山引擎方舟定价来源: https://www.volcengine.com/docs/82379/2188959 (Coding Plan)
   */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      // Anthropic
      'claude-opus-4': { input: 15, output: 75 },
      'claude-sonnet-4': { input: 3, output: 15 },
      'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
      'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
      // OpenAI
      'gpt-5': { input: 5, output: 15 },
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      // 火山引擎方舟 (Volcano Engine Ark) Coding Plan
      'doubao-seed-2.0-code': { input: 0.7, output: 2.8 },
      'doubao-seed-2.0-pro': { input: 1.4, output: 5.6 },
      'doubao-seed-2.0-lite': { input: 0.15, output: 0.6 },
      'doubao-seed-code': { input: 0.7, output: 2.8 },
      'kimi-k2.7-code': { input: 1.2, output: 4.8 },
      'kimi-k2.6': { input: 1.2, output: 4.8 },
      'glm-5.2': { input: 0.5, output: 1.5 },
      'deepseek-v4-pro': { input: 1.0, output: 4.0 },
      'deepseek-v4-flash': { input: 0.2, output: 0.8 },
      'minimax-m3': { input: 0.7, output: 2.8 },
      'ark-code-latest': { input: 1.0, output: 4.0 },
    };
    const p = pricing[model];
    if (!p) return 0;
    return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
  }
}
