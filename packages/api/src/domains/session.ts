/**
 * Session 域 — 会话管理
 * 对应 06-详细设计文档 §4.2.2
 */
import { z } from 'zod';
import type { Session, AgentMode } from '../types.js';

export const SessionCreateParams = z.object({
  projectId: z.string().min(1),
  title: z.string().optional(),
  mode: z.enum(['ask', 'plan', 'build', 'review']).default('build'),
});

export const SessionListParams = z.object({
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});

export const SessionGetParams = z.object({
  sessionId: z.string().min(1),
});

export const SessionDeleteParams = z.object({
  sessionId: z.string().min(1),
});

export const SessionExportParams = z.object({
  sessionId: z.string().min(1),
  format: z.enum(['md', 'json', 'jsonl']).default('json'),
});

export const SessionForkParams = z.object({
  sessionId: z.string().min(1),
  fromMessageId: z.string().optional(),
});

export interface SessionCreateResult {
  sessionId: string;
  createdAt: number;
}

export interface SessionListResult {
  items: Session[];
  nextCursor?: string;
}

export interface SessionGetResult {
  session: Session;
  messages: import('../types.js').Message[];
  stats: {
    messageCount: number;
    stepCount: number;
    toolCallCount: number;
    tokenTotalIn: number;
    tokenTotalOut: number;
    costTotalUsd: number;
  };
}

export interface SessionExportResult {
  url: string;
  bytes: number;
}

export interface SessionForkResult {
  newSessionId: string;
}

export interface SessionDomain {
  'session.create': {
    params: z.infer<typeof SessionCreateParams>;
    result: SessionCreateResult;
  };
  'session.list': {
    params: z.infer<typeof SessionListParams>;
    result: SessionListResult;
  };
  'session.get': {
    params: z.infer<typeof SessionGetParams>;
    result: SessionGetResult;
  };
  'session.delete': {
    params: z.infer<typeof SessionDeleteParams>;
    result: { deleted: true };
  };
  'session.export': {
    params: z.infer<typeof SessionExportParams>;
    result: SessionExportResult;
  };
  'session.fork': {
    params: z.infer<typeof SessionForkParams>;
    result: SessionForkResult;
  };
}
