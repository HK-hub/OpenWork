/**
 * 事件订阅契约
 *
 * 后端通过 EventBus 发布事件,经 Transport 推送到前端 (notify)。
 * 前端通过 OpenCodeClient.on(event, cb) 订阅。
 */

// ════════════════════════════════════════
// Agent 执行事件
// ════════════════════════════════════════
export interface AgentStartedEvent {
  type: 'agent.started';
  sessionId: string;
  runId: string;
  prompt: string;
  mode: string;
  timestamp: number;
}

export interface AgentMessageEvent {
  type: 'agent.message';
  sessionId: string;
  runId: string;
  messageId: string;
  role: 'assistant';
  delta?: string;
  finishReason?: string;
  timestamp: number;
}

export interface AgentToolCallEvent {
  type: 'agent.tool_call';
  sessionId: string;
  runId: string;
  toolCallId: string;
  toolName: string;
  args: unknown;
  riskLevel: string;
  requiresApproval: boolean;
  timestamp: number;
}

export interface AgentToolResultEvent {
  type: 'agent.tool_result';
  sessionId: string;
  runId: string;
  toolCallId: string;
  status: string;
  durationMs?: number;
  timestamp: number;
}

export interface AgentLoopEvent {
  type: 'agent.loop';
  sessionId: string;
  runId: string;
  step: number;
  iteration: number;
  phase: string;
  subPhase?: string;
  timestamp: number;
}

export interface AgentCompletedEvent {
  type: 'agent.completed';
  sessionId: string;
  runId: string;
  status: 'completed' | 'stopped' | 'error';
  usage: { input: number; output: number; costUsd: number };
  timestamp: number;
}

export interface AgentPausedEvent {
  type: 'agent.paused';
  sessionId: string;
  runId: string;
  checkpointId: string;
  timestamp: number;
}

// ════════════════════════════════════════
// 会话事件
// ════════════════════════════════════════
export interface SessionCreatedEvent {
  type: 'session.created';
  sessionId: string;
  projectId: string;
  timestamp: number;
}

export interface SessionUpdatedEvent {
  type: 'session.updated';
  sessionId: string;
  changes: Record<string, unknown>;
  timestamp: number;
}

export interface SessionDeletedEvent {
  type: 'session.deleted';
  sessionId: string;
  timestamp: number;
}

// ════════════════════════════════════════
// 权限事件
// ════════════════════════════════════════
export interface PermissionRequestedEvent {
  type: 'permission.requested';
  approvalToken: string;
  scope: string;
  resource: string;
  expiresAt: number;
  timestamp: number;
}

export interface PermissionDecidedEvent {
  type: 'permission.decided';
  approvalToken: string;
  decision: 'allow' | 'deny';
  decidedBy: string;
  timestamp: number;
}

// ════════════════════════════════════════
// 配置事件
// ════════════════════════════════════════
export interface ConfigChangedEvent {
  type: 'config.changed';
  key: string;
  oldValue: unknown;
  newValue: unknown;
  scope: string;
  timestamp: number;
}

// ════════════════════════════════════════
// MCP 事件
// ════════════════════════════════════════
export interface McpServerStatusEvent {
  type: 'mcp.server_status';
  serverId: string;
  status: 'connected' | 'disconnected' | 'error';
  timestamp: number;
}

export interface McpToolsChangedEvent {
  type: 'mcp.tools_changed';
  serverId: string;
  added: string[];
  removed: string[];
  timestamp: number;
}

// ════════════════════════════════════════
// Transport 调试事件 (debug.rpc.trace)
// ════════════════════════════════════════
export interface RpcTraceEvent {
  type: 'debug.rpc.trace';
  direction: 'in' | 'out';
  transport: string;
  method: string;
  id: string | number | null;
  durationMs?: number;
  payload?: unknown;
  timestamp: number;
}

// ════════════════════════════════════════
// 事件联合类型
// ════════════════════════════════════════
export type AppEvent =
  | AgentStartedEvent
  | AgentMessageEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentLoopEvent
  | AgentCompletedEvent
  | AgentPausedEvent
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionDeletedEvent
  | PermissionRequestedEvent
  | PermissionDecidedEvent
  | ConfigChangedEvent
  | McpServerStatusEvent
  | McpToolsChangedEvent
  | RpcTraceEvent;

/** 所有事件类型字符串 */
export type EventType = AppEvent['type'];

/** 事件过滤器 (订阅时使用) */
export interface EventFilter {
  types?: EventType[];
  sessionId?: string;
  runId?: string;
}

/** 事件订阅句柄 */
export interface EventSubscription {
  subscriptionId: string;
  filter: EventFilter;
  unsubscribe: () => Promise<void>;
}
