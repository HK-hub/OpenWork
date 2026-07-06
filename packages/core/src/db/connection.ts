/**
 * 数据库连接管理 — better-sqlite3
 *
 * 对应 04-架构设计文档 v4.2 §11.2 SQLite 数据库层
 *      06-详细设计文档 v4.2 §2.1 DDL / §2.7 Worker SQLite 访问策略
 */
import Database from 'better-sqlite3';
import type { Database as DatabaseType } from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('DB');

export interface DatabaseOptions {
  path: string;
  walMode?: boolean;
  cacheSize?: number;
  verbose?: boolean;
  readonly?: boolean;
}

/**
 * 打开/创建 SQLite 数据库
 *
 * - WAL 模式: 多连接并发读支持 (Indexer Worker 可独立 RO 连接)
 * - busy_timeout: 5s 等待锁释放
 * - synchronous=NORMAL: 性能/可靠性平衡
 * - foreign_keys=ON: 启用外键约束
 */
export function openDatabase(opts: DatabaseOptions): DatabaseType {
  const { path, walMode = true, cacheSize = -64000, verbose = false, readonly = false } = opts;

  // 确保目录存在
  if (!readonly) {
    mkdirSync(dirname(path), { recursive: true });
  }

  log.info('opening database', { path, walMode, readonly });

  const db = new Database(path, { readonly, verbose: verbose ? (msg) => log.silly(msg) : undefined });

  // PRAGMA 配置
  if (walMode && !readonly) {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  db.pragma(`cache_size = ${cacheSize}`);

  log.info('database opened', {
    path,
    journalMode: db.pragma('journal_mode', { simple: true }),
    foreignKeys: db.pragma('foreign_keys', { simple: true }),
  });

  return db;
}

/** 关闭数据库 (优雅退出) */
export function closeDatabase(db: DatabaseType): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    db.close();
    log.info('database closed');
  } catch (err) {
    log.error('database close error', { error: (err as Error).message });
  }
}

/** 执行 SQL 文件 (按 ; 分割) */
export function execSqlFile(db: DatabaseType, sql: string): void {
  // 简单分割 (不支持 ; 在字符串/注释内)
  // 但我们的 migration 文件使用 -- @down 分隔 up/down,不会出现这种情况
  db.exec(sql);
}

export type Database = DatabaseType;
