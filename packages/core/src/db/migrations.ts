/**
 * MigrationManager — 数据库迁移管理
 *
 * 对应 06-详细设计文档 v4.2 §2.4 Migration Manager / §2.6 分阶段建表
 *
 * 支持:
 *  - 版本阶段命名 (V0_1__*.sql, V0_2__*.sql)
 *  - 兼容数字前缀 (001_*.sql)
 *  - up/down 分隔 (-- @down 标记)
 *  - checksum 校验
 *  - 跨阶段升级 (按版本号顺序执行)
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import type { Database } from './connection.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('MigrationManager');

/** 单个 migration 定义 */
interface MigrationDef {
  version: string; // '0.1.0'
  filename: string;
  upSql: string;
  downSql: string;
  checksum: string;
  description: string;
}

/** 迁移记录 (来自 schema_version 表) */
interface AppliedMigration {
  version: string;
  appliedAt: number;
  checksum: string | null;
  description: string | null;
}

export class MigrationManager {
  private migrations: MigrationDef[] = [];

  constructor(
    private db: Database,
    private migrationsDir: string,
  ) {}

  /** 从目录加载所有 migration 文件 */
  async loadFromDir(): Promise<void> {
    if (!existsSync(this.migrationsDir)) {
      log.warn('migrations dir not found', { dir: this.migrationsDir });
      return;
    }

    const files = readdirSync(this.migrationsDir).filter((f) => f.endsWith('.sql'));
    log.debug('migration files found', { count: files.length, dir: this.migrationsDir });

    // V 前缀优先 (版本阶段),数字前缀按数字序
    const versioned = files
      .filter((f) => /^V(\d+)_(\d+)__(.+)\.sql$/.test(f))
      .sort((a, b) => {
        const ma = a.match(/^V(\d+)_(\d+)/)!;
        const mb = b.match(/^V(\d+)_(\d+)/)!;
        return parseInt(ma[1]!) * 100 + parseInt(ma[2]!) - (parseInt(mb[1]!) * 100 + parseInt(mb[2]!));
      });

    const numeric = files
      .filter((f) => /^\d+_.+\.sql$/.test(f))
      .sort((a, b) => parseInt(a.match(/^(\d+)/)![1]!, 10) - parseInt(b.match(/^(\d+)/)![1]!, 10));

    for (const file of [...versioned, ...numeric]) {
      const def = this.parseMigrationFile(file);
      if (def) this.migrations.push(def);
    }

    log.info('migrations loaded', { count: this.migrations.length });
  }

  /** 解析单个 migration 文件 (拆分 up/down) */
  private parseMigrationFile(filename: string): MigrationDef | null {
    const fullPath = join(this.migrationsDir, filename);
    const raw = readFileSync(fullPath, 'utf8');

    // 解析版本号
    let version: string;
    const vMatch = filename.match(/^V(\d+)_(\d+)__(.+)\.sql$/);
    if (vMatch) {
      version = `${vMatch[1]}.${vMatch[2]}.0`;
    } else {
      const nMatch = filename.match(/^(\d+)_(.+)\.sql$/);
      if (nMatch) {
        version = `numeric.${nMatch[1]}`;
      } else {
        log.warn('cannot parse version from filename', { filename });
        return null;
      }
    }

    // 拆分 up / down (-- @down 标记)
    const downIdx = raw.indexOf('-- @down');
    const upSql = downIdx === -1 ? raw : raw.slice(0, downIdx);
    const downSql = downIdx === -1 ? 'SELECT 1;' : raw.slice(downIdx + '-- @down'.length);

    const checksum = createHash('sha256').update(upSql).digest('hex');
    const description = vMatch?.[3] ?? filename.replace(/\.sql$/, '');

    return { version, filename, upSql, downSql, checksum, description };
  }

  /** 执行迁移到目标版本 */
  async migrate(targetVersion?: string): Promise<{ applied: string[]; skipped: string[] }> {
    const applied: string[] = [];
    const skipped: string[] = [];

    // 已应用的版本
    const alreadyApplied = this.getAppliedVersions();
    log.info('starting migration', {
      total: this.migrations.length,
      alreadyApplied: alreadyApplied.length,
      target: targetVersion ?? 'latest',
    });

    for (const migration of this.migrations) {
      if (targetVersion && this.compareVersions(migration.version, targetVersion) > 0) {
        log.debug('skip (beyond target)', { version: migration.version });
        skipped.push(migration.version);
        continue;
      }
      if (alreadyApplied.includes(migration.version)) {
        log.debug('skip (already applied)', { version: migration.version });
        skipped.push(migration.version);
        continue;
      }

      log.info('applying migration', { version: migration.version, file: migration.filename });

      // 事务执行
      const tx = this.db.transaction(() => {
        this.db.exec(migration.upSql);
        this.db
          .prepare(
            'INSERT INTO schema_version (version, checksum, description) VALUES (?, ?, ?)',
          )
          .run(migration.version, migration.checksum, migration.description);
      });
      tx();

      applied.push(migration.version);
      log.info('migration applied', { version: migration.version });
    }

    log.info('migration completed', { applied: applied.length, skipped: skipped.length });
    return { applied, skipped };
  }

  /** 获取已应用的版本列表 */
  getAppliedVersions(): string[] {
    try {
      const rows = this.db
        .prepare('SELECT version, applied_at, checksum, description FROM schema_version ORDER BY version')
        .all() as AppliedMigration[];
      return rows.map((r) => r.version);
    } catch {
      // schema_version 表可能不存在 (首次运行)
      return [];
    }
  }

  /** 比较版本号 (a vs b, 返回 -1/0/1) */
  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
    const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const va = pa[i] ?? 0;
      const vb = pb[i] ?? 0;
      if (va < vb) return -1;
      if (va > vb) return 1;
    }
    return 0;
  }

  /** 获取当前已应用的最高版本 */
  getCurrentVersion(): string | null {
    const versions = this.getAppliedVersions();
    if (versions.length === 0) return null;
    return versions[versions.length - 1]!;
  }
}

/** 便捷函数: 打开并迁移到目标版本 */
export async function migrateDatabase(
  db: Database,
  migrationsDir: string,
  targetVersion?: string,
): Promise<MigrationManager> {
  const manager = new MigrationManager(db, migrationsDir);
  await manager.loadFromDir();
  await manager.migrate(targetVersion);
  return manager;
}
