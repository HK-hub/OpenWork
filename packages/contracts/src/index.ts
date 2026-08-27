import { z } from 'zod';

export const SESSION_STATUS = {
  Active: 'active', Paused: 'paused', Completed: 'completed', Error: 'error', Cancelled: 'cancelled',
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const MESSAGE_ROLE = { User: 'user', Assistant: 'assistant', System: 'system', Tool: 'tool' } as const;
export type MessageRole = (typeof MESSAGE_ROLE)[keyof typeof MESSAGE_ROLE];
export const MESSAGE_STATUS = { Complete: 'complete', Streaming: 'streaming', Error: 'error' } as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];
export const LOOP_PHASE = { Perceive: 'perceive', Act: 'act', Observe: 'observe' } as const;
export type LoopPhase = (typeof LOOP_PHASE)[keyof typeof LOOP_PHASE];
export const RUN_STATUS = {
  PendingApproval: 'pending_approval', Approved: 'approved', Rejected: 'rejected', Running: 'running',
  Succeeded: 'succeeded', Failed: 'failed', TimedOut: 'timed_out', WaitingInput: 'waiting_input',
} as const;
export type RunStatus = (typeof RUN_STATUS)[keyof typeof RUN_STATUS];
export const PERMISSION_LEVEL = { L0: 'L0', L1: 'L1', L2: 'L2', L3: 'L3' } as const;
export type PermissionLevel = (typeof PERMISSION_LEVEL)[keyof typeof PERMISSION_LEVEL];
export const PROVIDER_KIND = { OpenAICompatible: 'openai_compatible', Anthropic: 'anthropic', Ollama: 'ollama' } as const;
export type ProviderKind = (typeof PROVIDER_KIND)[keyof typeof PROVIDER_KIND];
export const CONFIG_SCOPE = { Global: 'global', Project: 'project', Session: 'session' } as const;
export type ConfigScope = (typeof CONFIG_SCOPE)[keyof typeof CONFIG_SCOPE];
export const TOOL_NAMES = {
  ReadFile: 'read_file', WriteFile: 'write_file', EditFile: 'edit_file', DeleteFile: 'delete_file', MoveFile: 'move_file',
  Glob: 'glob', Grep: 'grep', RunCommand: 'run_command', WebFetch: 'web_fetch', TodoWrite: 'todo_write',
} as const;
export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];
export const ERROR_CODES = {
  ValidationError: 'VALIDATION_ERROR', Unauthorized: 'UNAUTHORIZED', NotFound: 'NOT_FOUND',
  PathOutsideWhitelist: 'PATH_OUTSIDE_WHITELIST', PermissionDenied: 'PERMISSION_DENIED', ToolTimeout: 'TOOL_TIMEOUT',
  ProviderUnavailable: 'PROVIDER_UNAVAILABLE', BudgetExceeded: 'BUDGET_EXCEEDED', MaxStepsReached: 'MAX_STEPS_REACHED',
  SessionNotActive: 'SESSION_NOT_ACTIVE', ConfigRollbackConflict: 'CONFIG_ROLLBACK_CONFLICT', Internal: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ErrorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });
export const RegisterProjectSchema = z.object({ name: z.string().trim().min(1).max(120), rootPath: z.string().trim().min(1), description: z.string().max(500).optional() });
export type RegisterProjectInput = z.infer<typeof RegisterProjectSchema>;
export const CreateSessionSchema = z.object({ title: z.string().trim().min(1).max(200).optional(), providerId: z.string().uuid().optional(), modelLabel: z.string().max(120).optional(), maxSteps: z.number().int().positive().max(500).optional(), tokenBudget: z.number().int().positive().optional() });
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export const PatchSessionSchema = z.object({ title: z.string().trim().min(1).max(200).optional(), status: z.enum([SESSION_STATUS.Active, SESSION_STATUS.Paused, SESSION_STATUS.Completed, SESSION_STATUS.Cancelled]) });
export const SendMessageSchema = z.object({ requestId: z.string().min(1), sessionId: z.string().uuid(), content: z.string().min(1).max(100_000), attachments: z.array(z.unknown()).optional() });
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export const ToolDecisionSchema = z.object({ action: z.enum(['approve', 'reject']), scope: z.enum(['once', 'session']) });
export const ToolInputSchema = z.object({ requestId: z.string().min(1), toolCallId: z.string().uuid(), data: z.union([z.string(), z.instanceof(Uint8Array)]) });
export const UpsertProviderSchema = z.object({ name: z.string().trim().min(1), kind: z.enum([PROVIDER_KIND.OpenAICompatible, PROVIDER_KIND.Anthropic, PROVIDER_KIND.Ollama]), baseUrl: z.string().url().optional(), apiKey: z.string().optional(), defaultModel: z.string().optional(), fallbackProviderId: z.string().uuid().optional(), pricing: z.object({ inputPerMtok: z.number().nonnegative().optional(), outputPerMtok: z.number().nonnegative().optional() }).optional() });
export const UpsertConfigSchema = z.object({ value: z.unknown(), refId: z.string().uuid().optional() });

export const WS_EVENT_TYPES = {
  Ack: 'ack', StreamDelta: 'stream.delta', MessageAppended: 'message.appended', LoopStep: 'loop.step', ToolStatus: 'tool.status',
  ToolOutputChunk: 'tool.output.chunk', PermissionRequest: 'permission.request', SessionPatch: 'session.patch', Error: 'error', Pong: 'pong',
} as const;
export type WsEventType = (typeof WS_EVENT_TYPES)[keyof typeof WS_EVENT_TYPES];
export type WsEnvelope<T = unknown> = { v: 1; eventId: string; ts: string; type: WsEventType; payload: T };
export const WsEnvelopeSchema = z.object({ v: z.literal(1), eventId: z.string(), ts: z.string(), type: z.string(), payload: z.unknown() });

export type Project = { id: string; name: string; rootPath: string; description?: string; status: 'active' | 'archived'; sessionCount: number; createdAt: string; updatedAt: string };
export type Session = { id: string; projectId: string; title: string; status: SessionStatus; modelLabel?: string; maxSteps: number; tokenBudget?: number; totalPromptTokens: number; totalCompletionTokens: number; totalCostUsd: number; lastActivityAt: string; createdAt: string; updatedAt: string };
export type Message = { id: string; sessionId: string; parentMessageId?: string; editedFromMessageId?: string; seq: number; role: MessageRole; content: string; status: MessageStatus; createdAt: string };
export type ToolCall = { id: string; sessionId: string; toolName: ToolName; permissionLevel: PermissionLevel; status: RunStatus; input: unknown; output?: unknown; durationMs?: number; errorText?: string; approvalScope?: 'once' | 'session'; approvedByUser?: boolean };

export const TOOL_METADATA: Record<ToolName, { permissionLevel: PermissionLevel; description: string }> = {
  read_file: { permissionLevel: 'L0', description: 'Read a file inside a registered workspace' },
  glob: { permissionLevel: 'L0', description: 'Find files inside a registered workspace' },
  grep: { permissionLevel: 'L0', description: 'Search text inside a registered workspace' },
  web_fetch: { permissionLevel: 'L0', description: 'Fetch a public HTTP resource' },
  todo_write: { permissionLevel: 'L1', description: 'Update the session todo list' },
  write_file: { permissionLevel: 'L1', description: 'Create or replace a workspace file' },
  edit_file: { permissionLevel: 'L1', description: 'Apply a text edit to a workspace file' },
  run_command: { permissionLevel: 'L2', description: 'Run an interactive command in the workspace' },
  delete_file: { permissionLevel: 'L2', description: 'Delete a workspace file' },
  move_file: { permissionLevel: 'L2', description: 'Move a workspace path' },
};
