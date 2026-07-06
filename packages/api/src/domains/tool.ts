/**
 * Tool 域 — 工具调用与审批
 * 对应 06-详细设计文档 §4.2.3
 */
import { z } from 'zod';
import type { ToolDef, ToolResult } from '../types.js';

export const ToolListParams = z.object({
  category: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const ToolExecuteParams = z.object({
  tool: z.string().min(1),
  args: z.record(z.unknown()).default({}),
  sessionId: z.string().optional(),
  approvalToken: z.string().optional(),
});

export const ToolApproveParams = z.object({
  approvalToken: z.string().min(1),
  decision: z.enum(['allow', 'deny']),
  scope: z.string().optional(),
});

export interface ToolListResult {
  tools: ToolDef[];
}

export interface ToolExecuteResult extends ToolResult {}

export interface ToolDomain {
  'tool.list': {
    params: z.infer<typeof ToolListParams>;
    result: ToolListResult;
  };
  'tool.execute': {
    params: z.infer<typeof ToolExecuteParams>;
    result: ToolExecuteResult;
    stream?: { progress: number; message?: string };
  };
  'tool.approve': {
    params: z.infer<typeof ToolApproveParams>;
    result: { granted: true };
  };
}
