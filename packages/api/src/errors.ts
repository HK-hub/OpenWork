/**
 * 错误码定义
 *
 * 范围规划:
 *  -32700 ~ -32603: JSON-RPC 标准错误码
 *  -32000 ~ -32099: Transport 错误
 *  -32100 ~ -32999: 业务错误码
 */

// ════════════════════════════════════════
// JSON-RPC 标准错误码
// ════════════════════════════════════════
export const PARSE_ERROR = -32700 as const;
export const INVALID_REQUEST = -32600 as const;
export const METHOD_NOT_FOUND = -32601 as const;
export const INVALID_PARAMS = -32602 as const;
export const INTERNAL_ERROR = -32603 as const;

// ════════════════════════════════════════
// Transport 错误 (-32000 ~ -32099)
// ════════════════════════════════════════
export const TRANSPORT_ERROR = -32000 as const;
export const TRANSPORT_DISCONNECTED = -32001 as const;
export const TRANSPORT_TIMEOUT = -32002 as const;
export const TRANSPORT_AUTH_FAILED = -32003 as const;
export const TRANSPORT_RATE_LIMITED = -32004 as const;
export const TRANSPORT_BATCH_TOO_LARGE = -32005 as const;

// ════════════════════════════════════════
// 业务错误码 (-32100 ~ -32999)
// ════════════════════════════════════════
// 通用
export const NOT_FOUND = -32100 as const;
export const CONFLICT = -32101 as const;
export const VALIDATION_FAILED = -32102 as const;
export const STATE_INVALID = -32103 as const;

// 权限
export const PERM_DENIED = -32200 as const;
export const PERM_EXPIRED = -32201 as const;
export const PERM_APPROVAL_REQUIRED = -32202 as const;
export const PERM_SCOPE_INSUFFICIENT = -32203 as const;

// Agent Loop
export const LOOP_NOT_RUNNING = -32300 as const;
export const LOOP_ALREADY_RUNNING = -32301 as const;
export const LOOP_MAX_ITERATIONS = -32302 as const;
export const LOOP_PAUSED = -32303 as const;
export const LOOP_CHECKPOINT_RESTORE_FAILED = -32304 as const;

// 预算 / 成本
export const BUDGET_EXCEEDED = -32400 as const;
export const TOKEN_LIMIT_EXCEEDED = -32401 as const;

// 模型
export const MODEL_PROVIDER_ERROR = -32500 as const;
export const MODEL_RATE_LIMITED = -32501 as const;
export const MODEL_CONTEXT_TOO_LONG = -32502 as const;
export const MODEL_API_KEY_MISSING = -32503 as const;

// 工具 (-32610 ~ -32619,避开 JSON-RPC 标准保留区 -32700 ~ -32603)
export const TOOL_NOT_FOUND = -32610 as const;
export const TOOL_EXECUTION_FAILED = -32611 as const;
export const TOOL_TIMEOUT = -32612 as const;

// MCP (-32710 ~ -32719,避开 JSON-RPC PARSE_ERROR -32700)
export const MCP_SERVER_UNREACHABLE = -32710 as const;
export const MCP_TOOL_NOT_FOUND = -32711 as const;

/** 错误码 → 消息模板 (用于快速构造错误响应) */
export const ERROR_MESSAGES: Record<number, string> = {
  [PARSE_ERROR]: 'Parse error',
  [INVALID_REQUEST]: 'Invalid Request',
  [METHOD_NOT_FOUND]: 'Method not found',
  [INVALID_PARAMS]: 'Invalid params',
  [INTERNAL_ERROR]: 'Internal error',

  [TRANSPORT_ERROR]: 'Transport error',
  [TRANSPORT_DISCONNECTED]: 'Connection disconnected',
  [TRANSPORT_TIMEOUT]: 'Request timeout',
  [TRANSPORT_AUTH_FAILED]: 'Authentication failed',
  [TRANSPORT_RATE_LIMITED]: 'Rate limited',
  [TRANSPORT_BATCH_TOO_LARGE]: 'Batch request too large',

  [NOT_FOUND]: 'Resource not found',
  [CONFLICT]: 'Resource conflict',
  [VALIDATION_FAILED]: 'Validation failed',
  [STATE_INVALID]: 'Invalid state',

  [PERM_DENIED]: 'Permission denied',
  [PERM_EXPIRED]: 'Permission expired',
  [PERM_APPROVAL_REQUIRED]: 'Approval required',
  [PERM_SCOPE_INSUFFICIENT]: 'Insufficient permission scope',

  [LOOP_NOT_RUNNING]: 'Agent loop not running',
  [LOOP_ALREADY_RUNNING]: 'Agent loop already running',
  [LOOP_MAX_ITERATIONS]: 'Max iterations reached',
  [LOOP_PAUSED]: 'Agent loop is paused',
  [LOOP_CHECKPOINT_RESTORE_FAILED]: 'Checkpoint restore failed',

  [BUDGET_EXCEEDED]: 'Budget exceeded',
  [TOKEN_LIMIT_EXCEEDED]: 'Token limit exceeded',

  [MODEL_PROVIDER_ERROR]: 'Model provider error',
  [MODEL_RATE_LIMITED]: 'Model rate limited',
  [MODEL_CONTEXT_TOO_LONG]: 'Context length exceeded',
  [MODEL_API_KEY_MISSING]: 'API key missing',

  [TOOL_NOT_FOUND]: 'Tool not found',
  [TOOL_EXECUTION_FAILED]: 'Tool execution failed',
  [TOOL_TIMEOUT]: 'Tool execution timeout',

  [MCP_SERVER_UNREACHABLE]: 'MCP server unreachable',
  [MCP_TOOL_NOT_FOUND]: 'MCP tool not found',
};

/** 业务错误异常 (供后端 handler 抛出) */
export class RpcException extends Error {
  constructor(
    public readonly code: number,
    message?: string,
    public readonly data?: unknown,
  ) {
    super(message ?? ERROR_MESSAGES[code] ?? 'Unknown error');
    this.name = 'RpcException';
  }
}
