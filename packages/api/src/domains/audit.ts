/**
 * Audit 域 — 审计日志
 * 对应 06-详细设计文档 §4.2.14
 */
import { z } from 'zod';
import type { AuditEntry } from '../types.js';

export const AuditQueryParams = z.object({
  filter: z
    .object({
      actor: z.string().optional(),
      action: z.string().optional(),
      resource: z.string().optional(),
      sessionId: z.string().optional(),
      from: z.number().optional(),
      to: z.number().optional(),
    })
    .optional(),
  limit: z.number().int().positive().max(500).default(100),
  cursor: z.string().optional(),
});

export const AuditExportParams = z.object({
  filter: z.record(z.unknown()),
  format: z.enum(['json', 'csv']),
});

export interface AuditDomain {
  'audit.query': {
    params: z.infer<typeof AuditQueryParams>;
    result: { items: AuditEntry[]; nextCursor?: string };
  };
  'audit.export': {
    params: z.infer<typeof AuditExportParams>;
    result: { url: string; bytes: number };
  };
}
