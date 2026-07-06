/**
 * Memory Repository
 * 对应 memories 表 (v0.1 简化版)
 */
import type { ID, Memory, MemoryCategory } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genMemoryId } from '../../utils/id-generator.js';

export interface CreateMemoryInput {
  sessionId?: ID;
  category: MemoryCategory;
  content: string;
  metadata?: Record<string, unknown>;
  importance?: number;
}

export class MemoryRepository extends BaseRepository<Memory> {
  constructor(db: Database) {
    super(db, 'memories', 'id');
  }

  create(input: CreateMemoryInput): Memory {
    const id = genMemoryId();
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO memories (id, session_id, category, content, metadata, importance, access_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        input.sessionId ?? null,
        input.category,
        input.content,
        input.metadata ? JSON.stringify(input.metadata) : null,
        input.importance ?? 0.5,
        now,
        now,
      );
    return this.findById(id)!;
  }

  list(opts: { sessionId?: string; category?: string; limit?: number }): Memory[] {
    const limit = opts.limit ?? 50;
    if (opts.sessionId && opts.category) {
      return this.db
        .prepare('SELECT * FROM memories WHERE session_id = ? AND category = ? ORDER BY created_at DESC LIMIT ?')
        .all(opts.sessionId, opts.category, limit) as Memory[];
    }
    if (opts.sessionId) {
      return this.db
        .prepare('SELECT * FROM memories WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
        .all(opts.sessionId, limit) as Memory[];
    }
    if (opts.category) {
      return this.db
        .prepare('SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC LIMIT ?')
        .all(opts.category, limit) as Memory[];
    }
    return this.db
      .prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?')
      .all(limit) as Memory[];
  }

  /** v0.1 简单 LIKE 搜索 (v0.2+ 接入向量检索) */
  search(query: string, k = 5, filter?: { sessionId?: string; category?: string }): Memory[] {
    const pattern = `%${query}%`;
    if (filter?.sessionId && filter?.category) {
      return this.db
        .prepare('SELECT * FROM memories WHERE session_id = ? AND category = ? AND content LIKE ? ORDER BY importance DESC LIMIT ?')
        .all(filter.sessionId, filter.category, pattern, k) as Memory[];
    }
    if (filter?.sessionId) {
      return this.db
        .prepare('SELECT * FROM memories WHERE session_id = ? AND content LIKE ? ORDER BY importance DESC LIMIT ?')
        .all(filter.sessionId, pattern, k) as Memory[];
    }
    if (filter?.category) {
      return this.db
        .prepare('SELECT * FROM memories WHERE category = ? AND content LIKE ? ORDER BY importance DESC LIMIT ?')
        .all(filter.category, pattern, k) as Memory[];
    }
    return this.db
      .prepare('SELECT * FROM memories WHERE content LIKE ? ORDER BY importance DESC LIMIT ?')
      .all(pattern, k) as Memory[];
  }

  touch(id: ID): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .prepare('UPDATE memories SET access_count = access_count + 1, last_accessed_at = ?, updated_at = ? WHERE id = ?')
      .run(now, now, id).changes > 0;
  }
}
