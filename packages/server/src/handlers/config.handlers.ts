/**
 * Config 域 handlers
 * 对应 @opencode/api ConfigDomain
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine, Database } from '@opencode/core';
import { ConfigRepository } from '@opencode/core';
import { RpcException } from '@opencode/api';
import { moduleLogger } from '@opencode/core';

const log = moduleLogger('ConfigHandlers');

export function registerConfigHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  core: CoreEngine,
  db: Database | null,
): void {
  const configRepo = db ? new ConfigRepository(db) : null;

  // config.get
  router.register('config.get', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { key?: string; profile?: string };
    if (!configRepo) return { value: undefined };
    if (params.key) {
      return { value: configRepo.getValue(params.key, 'global', params.profile) };
    }
    // 返回所有配置
    const entries = configRepo.list('global', params.profile);
    const result: Record<string, unknown> = {};
    for (const e of entries) {
      try {
        result[e.key] = JSON.parse(e.value as unknown as string);
      } catch {
        result[e.key] = e.value;
      }
    }
    return { value: result };
  });

  // config.set
  router.register('config.set', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { key: string; value: unknown; profile?: string };
    if (!params.key) throw new RpcException(-32602, 'key required');
    if (!configRepo) return { validated: true as const, oldValue: undefined };
    const oldEntry = configRepo.get(params.key, 'global', params.profile);
    const oldValue = oldEntry?.value;
    configRepo.set(params.key, params.value, 'global', params.profile);
    log.info('config set', { key: params.key });
    return { validated: true as const, oldValue };
  });

  // config.list
  router.register('config.list', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { profile?: string };
    if (!configRepo) return { entries: [] };
    const entries = configRepo.list('global', params.profile);
    return { entries };
  });

  // config.validate (stub)
  router.register('config.validate', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    return { valid: true, errors: [] };
  });
}
