/**
 * Session Repository
 * 对应 sessions 表
 */
import type { ID, Session, SessionStatus, AgentMode } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genSessionId } from '../../utils/id-generator.js';

export interface CreateSessionInput {
  projectId: ID;
  profileId?: ID;
  title?: string;
  mode?: AgentMode;
  parentSessionId?: ID;
  parentStepId?: ID;
}

export class SessionRepository extends BaseRepository<Session> {
  constructor(db: Database) {
    super(db, 'sessions', 'id');
  }

  create(input: CreateSessionInput): Session {
    const id = genSessionId();
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO sessions (id, project_id, profile_id, parent_session_id, parent_step_id, title, mode, status, last_active_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.profileId ?? null,
        input.parentSessionId ?? null,
        input.parentStepId ?? null,
        input.title ?? null,
        input.mode ?? 'build',
        now,
        now,
        now,
      );
    return this.findById(id)!;
  }

  listByProject(projectId: ID, limit = 50): Session[] {
    return this.db
      .prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY last_active_at DESC LIMIT ?')
      .all(projectId, limit) as Session[];
  }

  listActive(limit = 20): Session[] {
    return this.db
      .prepare(`SELECT * FROM sessions WHERE status = 'active' ORDER BY last_active_at DESC LIMIT ?`)
      .all(limit) as Session[];
  }

  updateStatus(id: ID, status: SessionStatus): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.updateFields(id, { status, updated_at: now, last_active_at: now });
  }

  incrementCounters(
    id: ID,
    fields: Partial<Pick<Session, 'messageCount' | 'stepCount' | 'toolCallCount' | 'tokenTotalIn' | 'tokenTotalOut' | 'costTotalUsd' | 'durationTotalMs'>>,
  ): boolean {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (fields.messageCount) { sets.push('message_count = message_count + ?'); params.push(fields.messageCount); }
    if (fields.stepCount) { sets.push('step_count = step_count + ?'); params.push(fields.stepCount); }
    if (fields.toolCallCount) { sets.push('tool_call_count = tool_call_count + ?'); params.push(fields.toolCallCount); }
    if (fields.tokenTotalIn) { sets.push('token_total_in = token_total_in + ?'); params.push(fields.tokenTotalIn); }
    if (fields.tokenTotalOut) { sets.push('token_total_out = token_total_out + ?'); params.push(fields.tokenTotalOut); }
    if (fields.costTotalUsd) { sets.push('cost_total_usd = cost_total_usd + ?'); params.push(fields.costTotalUsd); }
    if (fields.durationTotalMs) { sets.push('duration_total_ms = duration_total_ms + ?'); params.push(fields.durationTotalMs); }
    if (sets.length === 0) return false;
    sets.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));
    params.push(id);
    const result = this.db.prepare(`UPDATE sessions SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return result.changes > 0;
  }

  touch(id: ID): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.updateFields(id, { last_active_at: now, updated_at: now });
  }

  search(query: string, limit = 20): Session[] {
    const pattern = `%${query}%`;
    return this.db
      .prepare(`SELECT * FROM sessions WHERE title LIKE ? OR description LIKE ? ORDER BY last_active_at DESC LIMIT ?`)
      .all(pattern, pattern, limit) as Session[];
  }
}
