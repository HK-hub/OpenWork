/**
 * 共享类型定义 (前后端通用)
 *
 * 这些类型对应数据库 schema 中的核心实体,由 @opencode/api 包导出,
 * 前后端共享以保证类型安全。
 */
import type { z } from 'zod';

// ════════════════════════════════════════
// 基础类型
// ════════════════════════════════════════
export type ISODateString = string;
export type UnixTimestamp = number;
export type ID = string;
export type JsonString = string;

// ════════════════════════════════════════
// 项目
// ════════════════════════════════════════
export interface Project {
  id: ID;
  path: string;
  name: string;
  description?: string;
  rootGitHash?: string;
  gitBranch?: string;
  language?: string;
  framework?: string;
  packageManager?: string;
  icon?: string;
  color?: string;
  settings?: JsonString;
  lastOpenedAt: UnixTimestamp;
  pinned: boolean;
  archived: boolean;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

// ════════════════════════════════════════
// 会话
// ════════════════════════════════════════
export type SessionStatus = 'active' | 'paused' | 'archived' | 'forked' | 'abandoned';
export type AgentMode = 'ask' | 'plan' | 'build' | 'review';
export type TerminationReason =
  | 'completed'
  | 'user_stop'
  | 'max_iter'
  | 'cost_exceeded'
  | 'error'
  | 'cancelled';

export interface Session {
  id: ID;
  projectId: ID;
  profileId?: ID;
  parentSessionId?: ID;
  parentStepId?: ID;
  title?: string;
  description?: string;
  status: SessionStatus;
  mode: AgentMode;
  /** JSON 字符串 (model snapshot 序列化) */
  modelSnapshot?: string;
  /** JSON 字符串 (profile snapshot 序列化) */
  profileSnapshot?: string;
  tokenTotalIn: number;
  tokenTotalOut: number;
  tokenTotalCache: number;
  costTotalUsd: number;
  durationTotalMs: number;
  messageCount: number;
  stepCount: number;
  toolCallCount: number;
  subAgentCount: number;
  /** JSON 字符串 (string[] 序列化) */
  tags?: string;
  isFavorite: boolean;
  isPinned: boolean;
  terminationReason?: TerminationReason;
  terminationDetail?: string;
  lastActiveAt: UnixTimestamp;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

// ════════════════════════════════════════
// 消息
// ════════════════════════════════════════
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system' | 'sub_agent';
export type FinishReason =
  | 'stop'
  | 'tool_calls'
  | 'length'
  | 'error'
  | 'interrupted'
  | 'cancelled';

export interface ContentPart {
  type: 'text' | 'image' | 'tool_call' | 'tool_result' | 'file' | 'thinking';
  text?: string;
  imageUrl?: string;
  toolCallId?: ID;
  toolResult?: unknown;
  fileName?: string;
  thinking?: string;
}

export interface MessageContent {
  parts: ContentPart[];
}

export interface Message {
  id: ID;
  sessionId: ID;
  seq: number;
  role: MessageRole;
  subAgentId?: ID;
  /** JSON 字符串 (MessageContent 序列化); 使用 parseMessageContent() 解析 */
  content: string;
  originalContent?: string;
  editedAt?: UnixTimestamp;
  editedBy?: 'user' | 'agent' | 'system';
  isStale: boolean;
  isPinned: boolean;
  promptSnapshotHash?: string;
  promptSnapshotPath?: string;
  tokenIn?: number;
  tokenOut?: number;
  tokenCache?: number;
  costUsd?: number;
  modelName?: string;
  modelProvider?: string;
  finishReason?: FinishReason;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: UnixTimestamp;
}

// ════════════════════════════════════════
// Loop Step (PAOR)
// ════════════════════════════════════════
export type LoopPhase =
  | 'perceive'
  | 'act'
  | 'observe'
  | 'reflect'
  | 'plan'
  | 'verify'
  | 'recover';

export type LoopStepStatus = 'success' | 'error' | 'skipped' | 'cancelled' | 'pending';

export interface LoopStep {
  id: ID;
  sessionId: ID;
  step: number;
  iteration: number;
  phase: LoopPhase;
  subPhase?: string;
  parentLoopStepId?: ID;
  subAgentId?: ID;
  subAgentInstance?: string;
  payload: unknown;
  payloadSummary?: string;
  tokenIn?: number;
  tokenOut?: number;
  costUsd?: number;
  durationMs?: number;
  isCheckpoint: boolean;
  isSubAgentRoot: boolean;
  status: LoopStepStatus;
  errorCode?: string;
  errorMessage?: string;
  createdAt: UnixTimestamp;
}

// ════════════════════════════════════════
// 工具调用
// ════════════════════════════════════════
export type ToolSource = 'builtin' | 'mcp' | 'plugin' | 'skill' | 'custom' | 'sub_agent';
export type RiskLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type ToolCallStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'denied'
  | 'running'
  | 'success'
  | 'error'
  | 'timeout'
  | 'user_modified'
  | 'cancelled';

export interface ToolCall {
  id: ID;
  messageId: ID;
  sessionId: ID;
  loopStepId?: ID;
  subAgentInstance?: string;
  stepNumber: number;
  callIndex: number;
  toolName: string;
  toolSource: ToolSource;
  toolSourceId?: string;
  toolVersion?: string;
  args: unknown;
  argsSchemaHash?: string;
  result?: unknown;
  resultSummary?: string;
  originalResult?: unknown;
  modifiedResult?: unknown;
  modifiedBy?: string;
  modifiedAt?: UnixTimestamp;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  approvalId?: ID;
  approvedBy?: 'auto' | 'user' | 'session' | 'project' | 'permanent' | 'denied';
  approvalTimestamp?: UnixTimestamp;
  durationMs?: number;
  tokensIncluded: number;
  status: ToolCallStatus;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  retryParentId?: ID;
  createdAt: UnixTimestamp;
  completedAt?: UnixTimestamp;
}

// ════════════════════════════════════════
// 工具定义 (Tool Manifest)
// ════════════════════════════════════════
export interface ToolDef {
  name: string;
  description: string;
  source: ToolSource;
  sourceId?: string;
  version?: string;
  parametersSchema: JsonSchema;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  enabled: boolean;
  category?: string;
}

/** 简化版 JSON Schema (用于工具参数) */
export interface JsonSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  description?: string;
  required?: string[];
  enum?: unknown[];
  default?: unknown;
}

export interface ToolResult {
  callId: ID;
  output: unknown;
  meta?: {
    durationMs?: number;
    tokensIncluded?: number;
    isError?: boolean;
  };
}

// ════════════════════════════════════════
// 检查点
// ════════════════════════════════════════
export interface Checkpoint {
  id: ID;
  sessionId: ID;
  step: number;
  iteration: number;
  phase: LoopPhase;
  subAgentInstance?: string;
  snapshot: unknown;
  snapshotPath?: string;
  messageSeq?: number;
  tokenUsage?: number;
  costUsd?: number;
  isAuto: boolean;
  isRestored: boolean;
  label?: string;
  description?: string;
  createdAt: UnixTimestamp;
}

// ════════════════════════════════════════
// 记忆
// ════════════════════════════════════════
export type MemoryCategory =
  | 'preference'
  | 'fact'
  | 'skill'
  | 'episode'
  | 'procedure'
  | 'context';

export interface Memory {
  id: ID;
  sessionId?: ID;
  category: MemoryCategory;
  content: string;
  metadata?: Record<string, unknown>;
  importance: number; // 0-1
  lastAccessedAt?: UnixTimestamp;
  accessCount: number;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

// ════════════════════════════════════════
// 配置
// ════════════════════════════════════════
export type ConfigScope = 'global' | 'project' | 'session';

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: ConfigScope;
  profileId?: ID;
  updatedAt: UnixTimestamp;
}

// ════════════════════════════════════════
// Profile (模型配置档案)
// ════════════════════════════════════════
export interface Profile {
  id: ID;
  name: string;
  description?: string;
  base?: ID;
  provider: ModelProvider;
  model: string;
  /** JSON 字符串 (ModelParams 序列化) */
  params?: string;
  /** JSON 字符串 (RouterConfig 序列化) */
  router?: string;
  isDefault: boolean;
  createdAt: UnixTimestamp;
  updatedAt: UnixTimestamp;
}

export type ModelProvider = 'anthropic' | 'openai' | 'ollama' | 'openai-compat' | 'custom';

export interface ModelParams {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stop?: string[];
}

export interface RouterConfig {
  fallback?: { provider: ModelProvider; model: string }[];
  strategy?: 'cost' | 'latency' | 'quality';
}

// ════════════════════════════════════════
// 审计日志
// ════════════════════════════════════════
export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'approve'
  | 'deny'
  | 'export'
  | 'login'
  | 'logout'
  | 'config_change';

export interface AuditEntry {
  id: ID;
  timestamp: UnixTimestamp;
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: ID;
  sessionId?: ID;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ════════════════════════════════════════
// 权限
// ════════════════════════════════════════
export type PermissionScope =
  | 'tool.execute'
  | 'file.read'
  | 'file.write'
  | 'shell.exec'
  | 'network'
  | 'config.set';

export type PermissionDecision = 'allow' | 'deny' | 'ask';

export interface PermissionRule {
  id: ID;
  scope: PermissionScope;
  resource: string;
  decision: PermissionDecision;
  ttl?: number;
  createdAt: UnixTimestamp;
}

export interface PermissionRequest {
  approvalToken: string;
  scope: PermissionScope;
  resource: string;
  ttl: number;
  expiresAt: UnixTimestamp;
}

export interface PermissionGrant {
  approvalToken: string;
  scope: PermissionScope;
  grantedAt: UnixTimestamp;
}

// ════════════════════════════════════════
// Agent 运行
// ════════════════════════════════════════
export type RunStatus = 'running' | 'paused' | 'completed' | 'stopped' | 'error';

export interface TaskInput {
  sessionId: ID;
  prompt: string;
  mode?: AgentMode;
  tools?: string[];
  budget?: {
    hardCapUsd?: number;
    maxIterations?: number;
  };
  stream?: boolean;
  /** 显式覆盖当前 run 的模型 ID (如 'anthropic/claude-sonnet-4') */
  model?: string;
  /** 显式覆盖当前 run 的 provider */
  provider?: string;
  /** 模型推理参数覆盖 */
  params?: { temperature?: number; maxTokens?: number; topP?: number; stop?: string[] };
}

export interface AgentRunResult {
  runId: ID;
  status: RunStatus;
}

export interface AgentStreamChunk {
  stream: 'chunk';
  delta: string;
  toolCallId?: ID;
}

export interface AgentStreamEnd {
  stream: 'end';
  runId: ID;
  status: RunStatus;
  usage: {
    input: number;
    output: number;
    costUsd: number;
  };
  finalText?: string;
}

// ════════════════════════════════════════
// 通用分页
// ════════════════════════════════════════
export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
}

// 类型导出 helper
export type InferSchema<T extends z.ZodTypeAny> = z.infer<T>;
