/**
 * Config Repository
 * 对应 configs 表 (key-value 配置)
 */
import type { ConfigEntry, ConfigScope } from '@opencode/api';
import type { Database } from '../connection.js';

export class ConfigRepository {
  constructor(private db: Database) {}

  get(key: string, scope: ConfigScope = 'global', profileId?: string): ConfigEntry | undefined {
    return this.db
      .prepare('SELECT * FROM configs WHERE key = ? AND scope = ? AND (profile_id = ? OR profile_id IS NULL) ORDER BY profile_id DESC LIMIT 1')
      .get(key, scope, profileId ?? null) as ConfigEntry | undefined;
  }

  getValue<T = unknown>(key: string, scope?: ConfigScope, profileId?: string): T | undefined {
    const entry = this.get(key, scope, profileId);
    if (!entry) return undefined;
    try {
      return JSON.parse(entry.value as unknown as string) as T;
    } catch {
      return entry.value as unknown as T;
    }
  }

  set(key: string, value: unknown, scope: ConfigScope = 'global', profileId?: string): ConfigEntry {
    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO configs (key, scope, profile_id, value, updated_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(key, scope, COALESCE(profile_id, '')) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .run(key, scope, profileId ?? null, valueStr, now);
    return this.get(key, scope, profileId)!;
  }

  list(scope?: ConfigScope, profileId?: string): ConfigEntry[] {
    if (scope && profileId) {
      return this.db
        .prepare('SELECT * FROM configs WHERE scope = ? AND (profile_id = ? OR profile_id IS NULL) ORDER BY key')
        .all(scope, profileId) as ConfigEntry[];
    }
    if (scope) {
      return this.db.prepare('SELECT * FROM configs WHERE scope = ? ORDER BY key').all(scope) as ConfigEntry[];
    }
    return this.db.prepare('SELECT * FROM configs ORDER BY scope, key').all() as ConfigEntry[];
  }

  delete(key: string, scope: ConfigScope = 'global', profileId?: string): boolean {
    return this.db
      .prepare('DELETE FROM configs WHERE key = ? AND scope = ? AND (profile_id = ? OR profile_id IS NULL)')
      .run(key, scope, profileId ?? null).changes > 0;
  }
}
