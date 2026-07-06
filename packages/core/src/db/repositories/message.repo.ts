/**
 * Message Repository
 * 对应 messages 表
 */
import type { ID, Message, MessageContent, MessageRole } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genMessageId } from '../../utils/id-generator.js';

export interface CreateMessageInput {
  sessionId: ID;
  role: MessageRole;
  content: MessageContent;
  subAgentId?: ID;
  tokenIn?: number;
  tokenOut?: number;
  costUsd?: number;
  modelName?: string;
  modelProvider?: string;
  finishReason?: string;
}

export class MessageRepository extends BaseRepository<Message> {
  constructor(db: Database) {
    super(db, 'messages', 'id');
  }

  create(input: CreateMessageInput): Message {
    const id = genMessageId();
    const now = Math.floor(Date.now() / 1000);

    // 自动分配 seq
    const lastSeq = (
      this.db
        .prepare('SELECT seq FROM messages WHERE session_id = ? ORDER BY seq DESC LIMIT 1')
        .get(input.sessionId) as { seq: number } | undefined
    )?.seq ?? 0;
    const seq = lastSeq + 1;

    this.db
      .prepare(
        `INSERT INTO messages (id, session_id, seq, role, sub_agent_id, content, token_in, token_out, cost_usd, model_name, model_provider, finish_reason, is_stale, is_pinned, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      )
      .run(
        id,
        input.sessionId,
        seq,
        input.role,
        input.subAgentId ?? null,
        JSON.stringify(input.content),
        input.tokenIn ?? null,
        input.tokenOut ?? null,
        input.costUsd ?? null,
        input.modelName ?? null,
        input.modelProvider ?? null,
        input.finishReason ?? null,
        now,
      );
    return this.findById(id)!;
  }

  listBySession(sessionId: ID, limit = 100): Message[] {
    return this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY seq ASC LIMIT ?')
      .all(sessionId, limit) as Message[];
  }

  listBySessionAfterSeq(sessionId: ID, seq: number, limit = 100): Message[] {
    return this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?')
      .all(sessionId, seq, limit) as Message[];
  }

  /** 反序列化 content (JSON → MessageContent) */
  getContent(message: Message): MessageContent {
    if (typeof message.content === 'string') {
      try {
        return JSON.parse(message.content as unknown as string) as MessageContent;
      } catch {
        return { parts: [{ type: 'text', text: message.content as unknown as string }] };
      }
    }
    return message.content as unknown as MessageContent;
  }

  countBySession(sessionId: ID): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?').get(sessionId) as { cnt: number }).cnt;
  }

  editContent(id: ID, content: MessageContent, editedBy: 'user' | 'agent' | 'system' = 'user'): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .prepare(
        `UPDATE messages SET original_content = content, content = ?, edited_at = ?, edited_by = ? WHERE id = ?`,
      )
      .run(JSON.stringify(content), now, editedBy, id).changes > 0;
  }
}
