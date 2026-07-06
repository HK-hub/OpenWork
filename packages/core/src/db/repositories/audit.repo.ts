/**
 * Audit Log Repository
 * 对应 audit_log 表 (append-only)
 */
import type { ID, AuditEntry, AuditAction } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genAuditId } from '../../utils/id-generator.js';

export interface CreateAuditInput {
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: ID;
  sessionId?: ID;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditRepository extends BaseRepository<AuditEntry> {
  constructor(db: Database) {
    super(db, 'audit_log', 'id');
  }

  append(input: CreateAuditInput): AuditEntry {
    const id = genAuditId();
    this.db
      .prepare(
        `INSERT INTO audit_log (id, actor, action, resource, resource_id, session_id, detail, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.actor,
        input.action,
        input.resource,
        input.resourceId ?? null,
        input.sessionId ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      );
    return this.findById(id)!;
  }

  query(filter: {
    actor?: string;
    action?: string;
    resource?: string;
    sessionId?: string;
    from?: number;
    to?: number;
    limit?: number;
  }): AuditEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filter.actor) { conditions.push('actor = ?'); params.push(filter.actor); }
    if (filter.action) { conditions.push('action = ?'); params.push(filter.action); }
    if (filter.resource) { conditions.push('resource = ?'); params.push(filter.resource); }
    if (filter.sessionId) { conditions.push('session_id = ?'); params.push(filter.sessionId); }
    if (filter.from) { conditions.push('timestamp >= ?'); params.push(filter.from); }
    if (filter.to) { conditions.push('timestamp <= ?'); params.push(filter.to); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const limit = filter.limit ?? 100;
    return this.db
      .prepare(`SELECT * FROM audit_log ${where} ORDER BY timestamp DESC LIMIT ?`)
      .all(...params, limit) as AuditEntry[];
  }
}
