/**
 * Project Repository
 * 对应 projects 表
 */
import type { ID, Project } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genProjectId } from '../../utils/id-generator.js';

export interface CreateProjectInput {
  path: string;
  name: string;
  description?: string;
  language?: string;
  framework?: string;
  packageManager?: string;
  icon?: string;
  color?: string;
}

export class ProjectRepository extends BaseRepository<Project> {
  constructor(db: Database) {
    super(db, 'projects', 'id');
  }

  create(input: CreateProjectInput): Project {
    const id = genProjectId();
    const now = Math.floor(Date.now() / 1000);
    this.db
      .prepare(
        `INSERT INTO projects (id, path, name, description, language, framework, package_manager, icon, color, last_opened_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.path,
        input.name,
        input.description ?? null,
        input.language ?? null,
        input.framework ?? null,
        input.packageManager ?? null,
        input.icon ?? null,
        input.color ?? null,
        now,
        now,
        now,
      );
    return this.findById(id)!;
  }

  findByPath(path: string): Project | undefined {
    return this.db.prepare('SELECT * FROM projects WHERE path = ?').get(path) as Project | undefined;
  }

  listRecent(limit = 20): Project[] {
    return this.db
      .prepare('SELECT * FROM projects WHERE archived = 0 ORDER BY pinned DESC, last_opened_at DESC LIMIT ?')
      .all(limit) as Project[];
  }

  touch(id: ID): boolean {
    const now = Math.floor(Date.now() / 1000);
    return this.updateFields(id, { last_opened_at: now, updated_at: now });
  }

  togglePin(id: ID, pinned: boolean): boolean {
    return this.updateFields(id, { pinned: pinned ? 1 : 0, updated_at: Math.floor(Date.now() / 1000) });
  }
}
