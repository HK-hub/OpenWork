/**
 * Repository 基类 — 通用 CRUD 操作
 *
 * 各表对应 Repository 继承此类,提供基础 CRUD 与查询。
 * 对应 06-详细设计文档 v4.2 §2.1 Repository 模式
 */
import type { Database } from '../connection.js';

export abstract class BaseRepository<T, ID = string> {
  constructor(
    protected db: Database,
    protected table: string,
    protected idColumn = 'id',
  ) {}

  /** 按 ID 查询 */
  findById(id: ID): T | undefined {
    return this.db.prepare(`SELECT * FROM ${this.table} WHERE ${this.idColumn} = ?`).get(id) as T | undefined;
  }

  /** 删除 */
  delete(id: ID): boolean {
    const result = this.db
      .prepare(`DELETE FROM ${this.table} WHERE ${this.idColumn} = ?`)
      .run(id);
    return result.changes > 0;
  }

  /** 软删除 (标记 archived) */
  softDelete(id: ID): boolean {
    if (!this.hasColumn('archived')) return this.delete(id);
    const result = this.db
      .prepare(`UPDATE ${this.table} SET archived = 1, updated_at = ? WHERE ${this.idColumn} = ?`)
      .run(Math.floor(Date.now() / 1000), id);
    return result.changes > 0;
  }

  /** 统计行数 */
  count(filter?: string, params?: unknown[]): number {
    if (filter) {
      return (this.db.prepare(`SELECT COUNT(*) as cnt FROM ${this.table} WHERE ${filter}`).get(...(params ?? [])) as {
        cnt: number;
      }).cnt;
    }
    return (this.db.prepare(`SELECT COUNT(*) as cnt FROM ${this.table}`).get() as { cnt: number }).cnt;
  }

  /** 检查列是否存在 (用于软删除兼容) */
  private hasColumn(col: string): boolean {
    const cols = this.db.prepare(`PRAGMA table_info(${this.table})`).all() as Array<{ name: string }>;
    return cols.some((c) => c.name === col);
  }

  /** 通用更新 (按 SET 字段) */
  protected updateFields(id: ID, fields: Record<string, unknown>): boolean {
    const keys = Object.keys(fields);
    if (keys.length === 0) return false;
    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const result = this.db
      .prepare(`UPDATE ${this.table} SET ${setClause} WHERE ${this.idColumn} = ?`)
      .run(...Object.values(fields), id);
    return result.changes > 0;
  }
}
