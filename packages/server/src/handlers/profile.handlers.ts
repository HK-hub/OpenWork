/**
 * Profile 域 handlers
 * 对应 @opencode/api ProfileDomain
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine, Database } from '@opencode/core';
import { ProfileRepository } from '@opencode/core';
import { RpcException, NOT_FOUND } from '@opencode/api';
import { moduleLogger } from '@opencode/core';

const log = moduleLogger('ProfileHandlers');

export function registerProfileHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  db: Database | null,
): void {
  const profileRepo = db ? new ProfileRepository(db) : null;

  // profile.list
  router.register('profile.list', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    if (!profileRepo) return { profiles: [] };
    return { profiles: profileRepo.listAll() };
  });

  // profile.create
  router.register('profile.create', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!profileRepo) throw new RpcException(-32103, 'Database not available');
    const params = (req.params ?? {}) as {
      name: string;
      base?: string;
      provider: string;
      model: string;
      params?: unknown;
    };
    if (!params.name || !params.provider || !params.model) {
      throw new RpcException(-32602, 'name, provider, model required');
    }
    const profile = profileRepo.create({
      name: params.name,
      base: params.base,
      provider: params.provider as 'anthropic' | 'openai' | 'ollama' | 'openai-compat' | 'custom',
      model: params.model,
      params: typeof params.params === 'string' ? JSON.parse(params.params) : params.params,
    });
    log.info('profile created', { profileId: profile.id, name: profile.name });
    return { profileId: profile.id };
  });

  // profile.switch
  router.register('profile.switch', async (req: JsonRpcRequest, _ctx: CallContext) => {
    if (!profileRepo) throw new RpcException(-32103, 'Database not available');
    const params = (req.params ?? {}) as { profileId: string };
    if (!params.profileId) throw new RpcException(-32602, 'profileId required');
    const profile = profileRepo.findById(params.profileId);
    if (!profile) throw new RpcException(NOT_FOUND, `Profile not found: ${params.profileId}`);
    profileRepo.setDefault(params.profileId);
    return { active: params.profileId };
  });

  // profile.export (stub)
  router.register('profile.export', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { profileId: string };
    return { url: `opencode://profiles/${params.profileId}.json`, bytes: 0 };
  });

  // profile.import (stub)
  router.register('profile.import', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    return { profileId: 'imported' };
  });
}
