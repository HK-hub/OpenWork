/**
 * Memory 域 — 记忆系统
 * 对应 06-详细设计文档 §4.2.5
 *
 * v0.1: 简化版,仅写入门槛 (短/长期记忆持久化在 memories 表,无向量检索)
 */
import { z } from 'zod';
import type { Memory } from '../types.js';

export const MemoryWriteParams = z.object({
  sessionId: z.string().optional(),
  category: z.enum(['preference', 'fact', 'skill', 'episode', 'procedure', 'context']),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const MemorySearchParams = z.object({
  query: z.string().min(1),
  k: z.number().int().positive().max(50).default(5),
  filter: z
    .object({
      sessionId: z.string().optional(),
      category: z.string().optional(),
    })
    .optional(),
});

export const MemoryListParams = z.object({
  sessionId: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50),
});

export const MemoryDeleteParams = z.object({
  memoryId: z.string().min(1),
});

export interface MemorySearchHit {
  memory: Memory;
  score: number;
}

export interface MemoryDomain {
  'memory.write': {
    params: z.infer<typeof MemoryWriteParams>;
    result: { memoryId: string };
  };
  'memory.search': {
    params: z.infer<typeof MemorySearchParams>;
    result: { items: MemorySearchHit[] };
  };
  'memory.list': {
    params: z.infer<typeof MemoryListParams>;
    result: { items: Memory[] };
  };
  'memory.delete': {
    params: z.infer<typeof MemoryDeleteParams>;
    result: { deleted: true };
  };
}
