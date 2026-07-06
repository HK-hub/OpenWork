/**
 * Agent 模块类型定义
 *
 * 对应 04-架构设计文档 v4.2 §7 Agent 核心层架构
 *      06-详细设计文档 v4.2 §3.1 LoopEngine
 */
import type {
  AgentMode,
  AgentRunResult,
  AgentStreamChunk,
  AgentStreamEnd,
  ID,
  LoopPhase,
  LoopStep,
  Message,
  Session,
  TaskInput,
  ToolCall,
} from '@opencode/api';

/** Agent 运行状态 */
export type RunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

/** Agent 运行上下文 */
export interface RunContext {
  runId: ID;
  sessionId: ID;
  prompt: string;
  mode: AgentMode;
  status: RunStatus;
  startedAt: number;
  pausedAt?: number;
  completedAt?: number;
  currentStep: number;
  currentIteration: number;
  currentPhase: LoopPhase;
  abortController: AbortController;
  budget: { hardCapUsd?: number; maxIterations?: number };
  usage: { input: number; output: number; costUsd: number };
  /** 模型生成的最终文本 (供 completed 事件回传) */
  finalText?: string;
}

/** Loop 单步执行结果 */
export interface LoopStepResult {
  stepId: ID;
  step: number;
  iteration: number;
  phase: LoopPhase;
  action: string;
  status: 'success' | 'error' | 'pending';
  toolCalls?: ToolCall[];
  message?: Message;
  durationMs: number;
}

/** Agent 事件流 (流式响应) */
export type AgentEvent =
  | { type: 'started'; runId: ID; sessionId: ID; timestamp: number }
  | { type: 'message'; runId: ID; messageId: ID; delta?: string; finishReason?: string; timestamp: number }
  | { type: 'tool_call'; runId: ID; toolCallId: ID; toolName: string; args: unknown; timestamp: number }
  | { type: 'tool_result'; runId: ID; toolCallId: ID; status: string; durationMs?: number; timestamp: number }
  | { type: 'loop'; runId: ID; step: number; iteration: number; phase: LoopPhase; subPhase?: string; timestamp: number }
  | { type: 'completed'; runId: ID; status: RunStatus; usage: { input: number; output: number; costUsd: number }; finalText?: string; timestamp: number }
  | { type: 'paused'; runId: ID; checkpointId: ID; timestamp: number }
  | { type: 'error'; runId: ID; error: string; timestamp: number };

/** Agent Loop Engine 接口 (供 Subagent 复用, v4.2 S5 反转依赖) */
export interface IAgentLoop {
  /** 启动 Agent 运行 */
  run(input: TaskInput): AsyncIterable<AgentEvent>;
  /** 停止运行 */
  stop(runId: ID, reason?: string): Promise<void>;
  /** 暂停 (创建检查点) */
  pause(runId: ID): Promise<{ checkpointId: ID }>;
  /** 恢复运行 */
  resume(runId: ID): Promise<void>;
  /** 单步执行 (调试模式) */
  step(runId: ID, kind: 'next' | 'over' | 'into'): Promise<LoopStepResult>;
  /** 检查运行状态 */
  inspect(runId: ID): RunContext | undefined;
}

/** Prompt 上下文消息 (扩展支持 tool_calls 协议) */
export interface PromptMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** assistant 消息附带的工具调用 (OpenAI/Anthropic 协议要求) */
  toolCalls?: Array<{ id: ID; name: string; args: unknown }>;
  /** tool 消息对应的 tool_call_id (用于关联到 assistant 的 tool_calls) */
  toolCallId?: ID;
}

/** Prompt 上下文 */
export interface PromptContext {
  system: string;
  messages: PromptMessage[];
  tools?: unknown[];
  modelSnapshot?: unknown;
}

/** Provider 调用请求 */
export interface ModelCallRequest {
  prompt: PromptContext;
  model: string;
  provider: string;
  params?: { temperature?: number; maxTokens?: number; topP?: number; stop?: string[] };
  stream: boolean;
  tools?: unknown[];
}

/** Provider 调用响应 (流式) */
export interface ModelCallChunk {
  delta?: string;
  toolCall?: { id: ID; name: string; args: unknown };
  finishReason?: string;
  usage?: { input: number; output: number };
}

/** Provider 调用完成 */
export interface ModelCallResult {
  content: string;
  toolCalls?: Array<{ id: ID; name: string; args: unknown }>;
  finishReason: string;
  usage: { input: number; output: number };
  costUsd: number;
}
