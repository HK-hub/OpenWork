/**
 * Permission 域 handlers
 * 对应 @opencode/api PermissionDomain
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine } from '@opencode/core';
import { RpcException } from '@opencode/api';

export function registerPermissionHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  core: CoreEngine,
): void {
  const gw = core.permissionGateway;

  // permission.request
  router.register('permission.request', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { scope: string; resource: string; ttl?: number };
    if (!params.scope || !params.resource) throw new RpcException(-32602, 'scope, resource required');
    return gw.request(
      params.scope as 'tool.execute' | 'file.read' | 'file.write' | 'shell.exec' | 'network' | 'config.set',
      params.resource,
      params.ttl,
    );
  });

  // permission.grant
  router.register('permission.grant', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { approvalToken: string; scope?: string };
    if (!params.approvalToken) throw new RpcException(-32602, 'approvalToken required');
    await gw.grant(params.approvalToken, params.scope);
    return { granted: true as const };
  });

  // permission.revoke
  router.register('permission.revoke', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { approvalToken: string };
    if (!params.approvalToken) throw new RpcException(-32602, 'approvalToken required');
    await gw.revoke(params.approvalToken);
    return { revoked: true as const };
  });

  // permission.list
  router.register('permission.list', async (_req: JsonRpcRequest, _ctx: CallContext) => {
    const result = gw.list();
    return { grants: result.grants };
  });
}
