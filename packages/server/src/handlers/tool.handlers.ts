/**
 * Tool 域 handlers — 工具调用与审批
 * 对应 @opencode/api ToolDomain
 */
import type { JsonRpcRequest } from '@opencode/api';
import type { MethodHandler, CallContext } from '../transports/types.js';
import type { CoreEngine } from '@opencode/core';
import { RpcException, TOOL_NOT_FOUND, PERM_DENIED } from '@opencode/api';
import { genToolCallId, moduleLogger } from '@opencode/core';

const log = moduleLogger('ToolHandlers');

export function registerToolHandlers(
  router: { register: (method: string, handler: MethodHandler) => void },
  core: CoreEngine,
): void {
  // tool.list
  router.register('tool.list', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { category?: string; enabled?: boolean };
    const tools = core.toolRegistry.list({ category: params.category, enabled: params.enabled });
    return { tools };
  });

  // tool.execute
  router.register('tool.execute', async (req: JsonRpcRequest, ctx: CallContext) => {
    const params = (req.params ?? {}) as {
      tool: string;
      args?: Record<string, unknown>;
      sessionId?: string;
      approvalToken?: string;
    };
    if (!params.tool) throw new RpcException(-32602, 'tool required');

    const def = core.toolRegistry.get(params.tool);
    if (!def) throw new RpcException(TOOL_NOT_FOUND, `Tool not found: ${params.tool}`);

    // 权限检查
    if (def.requiresApproval && !params.approvalToken) {
      const decision = core.permissionGateway.check('tool.execute', params.tool, def.riskLevel);
      if (decision === 'deny') throw new RpcException(PERM_DENIED, `Permission denied: ${params.tool}`);
      if (decision === 'ask') {
        // 触发 HITL
        const request = await core.permissionGateway.request('tool.execute', params.tool);
        return {
          callId: genToolCallId(),
          output: { status: 'awaiting_approval', approvalToken: request.approvalToken },
          meta: { isError: false },
        };
      }
    }

    const toolCallId = genToolCallId();
    log.info('tool.execute', { tool: params.tool, toolCallId });

    const result = await core.toolRegistry.execute(
      params.tool,
      params.args ?? {},
      { toolCallId, sessionId: params.sessionId, abortSignal: ctx.cancelSignal },
    );
    return { ...result, callId: toolCallId };
  });

  // tool.approve
  router.register('tool.approve', async (req: JsonRpcRequest, _ctx: CallContext) => {
    const params = (req.params ?? {}) as { approvalToken: string; decision: 'allow' | 'deny'; scope?: string };
    if (!params.approvalToken) throw new RpcException(-32602, 'approvalToken required');
    if (params.decision === 'allow') {
      await core.permissionGateway.grant(params.approvalToken, params.scope);
      return { granted: true as const };
    }
    await core.permissionGateway.revoke(params.approvalToken);
    return { granted: false };
  });
}
