/**
 * Agent 域 — Agent 执行控制
 * 对应 06-详细设计文档 §4.2.1
 */
import { z } from 'zod';
import type { AgentRunResult, AgentStreamChunk, AgentStreamEnd } from '../types.js';

export const AgentRunParams = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(1),
  mode: z.enum(['ask', 'plan', 'build', 'review']).default('build'),
  tools: z.array(z.string()).optional(),
  budget: z
    .object({
      hardCapUsd: z.number().positive().optional(),
      maxIterations: z.number().int().positive().optional(),
    })
    .optional(),
  stream: z.boolean().default(true),
  /** 显式覆盖模型 ID (如 'anthropic/claude-sonnet-4') */
  model: z.string().optional(),
  /** 显式覆盖 provider */
  provider: z.string().optional(),
  /** 推理参数覆盖 */
  params: z
    .object({
      temperature: z.number().optional(),
      maxTokens: z.number().int().positive().optional(),
      topP: z.number().optional(),
      stop: z.array(z.string()).optional(),
    })
    .optional(),
});

export const AgentStopParams = z.object({
  runId: z.string().min(1),
  reason: z.string().optional(),
});

export const AgentPauseParams = z.object({
  runId: z.string().min(1),
});

export const AgentResumeParams = z.object({
  runId: z.string().min(1),
});

export const AgentStepParams = z.object({
  runId: z.string().min(1),
  kind: z.enum(['next', 'over', 'into']).default('next'),
});

export const AgentInspectParams = z.object({
  runId: z.string().min(1),
});

export interface AgentStepResult {
  stepId: string;
  action: string;
  status: 'success' | 'error' | 'pending';
}

export interface AgentInspectResult {
  status: 'running' | 'paused' | 'completed' | 'stopped' | 'error';
  loop: {
    step: number;
    iteration: number;
    phase: string;
  };
  context: {
    tokenIn: number;
    tokenOut: number;
    messages: number;
  };
  toolCalls: {
    total: number;
    pending: number;
    awaitingApproval: number;
  };
  cost: {
    totalUsd: number;
    budgetUsd?: number;
  };
}

export interface AgentDomain {
  'agent.run': {
    params: z.infer<typeof AgentRunParams>;
    result: AgentRunResult;
    stream: AgentStreamChunk | AgentStreamEnd;
  };
  'agent.stop': {
    params: z.infer<typeof AgentStopParams>;
    result: { stopped: true };
  };
  'agent.pause': {
    params: z.infer<typeof AgentPauseParams>;
    result: { status: 'paused'; checkpointId: string };
  };
  'agent.resume': {
    params: z.infer<typeof AgentResumeParams>;
    result: { status: 'running' };
  };
  'agent.step': {
    params: z.infer<typeof AgentStepParams>;
    result: AgentStepResult;
  };
  'agent.inspect': {
    params: z.infer<typeof AgentInspectParams>;
    result: AgentInspectResult;
  };
}
