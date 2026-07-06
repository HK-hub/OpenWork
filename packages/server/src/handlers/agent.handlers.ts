/**
 * Agent 域 handlers — Agent 执行控制
 * 对应 @opencode/api AgentDomain (agent.run / stop / pause / resume / step / inspect)
 */
import type { JsonRpcRequest, AgentStreamChunk, AgentStreamEnd } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine } from '@opencode/core';
import { RpcException, NOT_FOUND, LOOP_NOT_RUNNING } from '@opencode/api';
import { moduleLogger } from '@opencode/core';

const log = moduleLogger('AgentHandlers');

export function registerAgentHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  core: CoreEngine,
): void {
  const loop = core.loopEngine;

  // agent.run (流式: 返回 AsyncIterable)
  router.register('agent.run', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as {
      sessionId: string;
      prompt: string;
      mode?: string;
      stream?: boolean;
      model?: string;
      provider?: string;
      params?: { temperature?: number; maxTokens?: number; topP?: number; stop?: string[] };
      tools?: string[];
      budget?: { hardCapUsd?: number; maxIterations?: number };
    };
    if (!params.sessionId || !params.prompt) {
      throw new RpcException(-32602, 'sessionId and prompt required');
    }
    log.info('agent.run', {
      sessionId: params.sessionId,
      prompt: params.prompt.slice(0, 80),
      model: params.model,
      provider: params.provider,
    });

    return (async function* (): AsyncIterable<AgentStreamChunk | AgentStreamEnd> {
      const events = loop.run({
        sessionId: params.sessionId,
        prompt: params.prompt,
        mode: params.mode as 'ask' | 'plan' | 'build' | 'review' | undefined,
        stream: true,
        model: params.model,
        provider: params.provider,
        params: params.params,
        tools: params.tools,
        budget: params.budget,
      });
      let runId = '';
      let finalText = '';
      let usage = { input: 0, output: 0, costUsd: 0 };
      let status: 'completed' | 'stopped' | 'error' = 'completed';

      for await (const evt of events) {
        if (evt.type === 'started') {
          runId = evt.runId;
          yield { stream: 'chunk' as const, delta: '' };
        } else if (evt.type === 'message' && evt.delta) {
          finalText += evt.delta;
          yield { stream: 'chunk' as const, delta: evt.delta };
        } else if (evt.type === 'completed') {
          usage = evt.usage;
          // 收敛 RunStatus 到 'completed' | 'stopped' | 'error'
          if (evt.status === 'stopped' || evt.status === 'error') {
            status = evt.status;
          } else {
            status = 'completed';
          }
        } else if (evt.type === 'error') {
          status = 'error';
          log.error('agent.run error', { error: evt.error });
        }
      }
      yield { stream: 'end' as const, runId, status, usage, finalText };
    })();
  });

  // agent.stop
  router.register('agent.stop', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { runId: string; reason?: string };
    if (!params.runId) throw new RpcException(-32602, 'runId required');
    await loop.stop(params.runId, params.reason);
    return { stopped: true as const };
  });

  // agent.pause
  router.register('agent.pause', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { runId: string };
    if (!params.runId) throw new RpcException(-32602, 'runId required');
    const result = await loop.pause(params.runId);
    return { status: 'paused' as const, checkpointId: result.checkpointId };
  });

  // agent.resume
  router.register('agent.resume', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { runId: string };
    if (!params.runId) throw new RpcException(-32602, 'runId required');
    await loop.resume(params.runId);
    return { status: 'running' as const };
  });

  // agent.step
  router.register('agent.step', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { runId: string; kind?: string };
    if (!params.runId) throw new RpcException(-32602, 'runId required');
    const result = await loop.step(params.runId, (params.kind as 'next' | 'over' | 'into') ?? 'next');
    return result;
  });

  // agent.inspect
  router.register('agent.inspect', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { runId: string };
    if (!params.runId) throw new RpcException(-32602, 'runId required');
    const ctx = loop.inspect(params.runId);
    if (!ctx) throw new RpcException(LOOP_NOT_RUNNING, `Run not found or not running: ${params.runId}`);
    return {
      status: ctx.status,
      loop: { step: ctx.currentStep, iteration: ctx.currentIteration, phase: ctx.currentPhase },
      context: { tokenIn: ctx.usage.input, tokenOut: ctx.usage.output, messages: 0 },
      toolCalls: { total: 0, pending: 0, awaitingApproval: 0 },
      cost: { totalUsd: ctx.usage.costUsd, budgetUsd: ctx.budget.hardCapUsd },
    };
  });
}
