/**
 * Profile Repository
 * 对应 profiles 表
 */
import type { ID, Profile, ModelProvider, ModelParams, RouterConfig } from '@opencode/api';
import { BaseRepository } from './base.js';
import type { Database } from '../connection.js';
import { genProfileId } from '../../utils/id-generator.js';

export interface CreateProfileInput {
  name: string;
  description?: string;
  base?: ID;
  provider: ModelProvider;
  model: string;
  params?: ModelParams;
  router?: RouterConfig;
  isDefault?: boolean;
}

export class ProfileRepository extends BaseRepository<Profile> {
  constructor(db: Database) {
    super(db, 'profiles', 'id');
  }

  create(input: CreateProfileInput): Profile {
    const id = genProfileId();
    const now = Math.floor(Date.now() / 1000);

    // 如果 isDefault=true,清除其他默认标记
    if (input.isDefault) {
      this.db.prepare('UPDATE profiles SET is_default = 0').run();
    }

    this.db
      .prepare(
        `INSERT INTO profiles (id, name, description, base, provider, model, params, router, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.name,
        input.description ?? null,
        input.base ?? null,
        input.provider,
        input.model,
        input.params ? JSON.stringify(input.params) : null,
        input.router ? JSON.stringify(input.router) : null,
        input.isDefault ? 1 : 0,
        now,
        now,
      );
    return this.findById(id)!;
  }

  findByName(name: string): Profile | undefined {
    return this.db.prepare('SELECT * FROM profiles WHERE name = ?').get(name) as Profile | undefined;
  }

  listAll(): Profile[] {
    return this.db.prepare('SELECT * FROM profiles ORDER BY name').all() as Profile[];
  }

  getDefault(): Profile | undefined {
    return this.db.prepare('SELECT * FROM profiles WHERE is_default = 1 LIMIT 1').get() as Profile | undefined;
  }

  setDefault(id: ID): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE profiles SET is_default = 0').run();
      this.db.prepare('UPDATE profiles SET is_default = 1, updated_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000), id);
    });
    tx();
    return true;
  }

  parseParams(profile: Profile): ModelParams | undefined {
    if (!profile.params) return undefined;
    try {
      return JSON.parse(profile.params as unknown as string) as ModelParams;
    } catch {
      return undefined;
    }
  }

  parseRouter(profile: Profile): RouterConfig | undefined {
    if (!profile.router) return undefined;
    try {
      return JSON.parse(profile.router as unknown as string) as RouterConfig;
    } catch {
      return undefined;
    }
  }
}
