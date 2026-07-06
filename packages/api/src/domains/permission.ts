/**
 * Permission 域 — 权限审批
 * 对应 06-详细设计文档 §4.2.13
 */
import { z } from 'zod';
import type { PermissionRule, PermissionRequest, PermissionGrant } from '../types.js';

export const PermissionRequestParams = z.object({
  scope: z.enum([
    'tool.execute',
    'file.read',
    'file.write',
    'shell.exec',
    'network',
    'config.set',
  ]),
  resource: z.string().min(1),
  ttl: z.number().int().positive().default(3600),
});

export const PermissionGrantParams = z.object({
  approvalToken: z.string().min(1),
  scope: z.string().min(1),
});

export const PermissionRevokeParams = z.object({
  approvalToken: z.string().min(1),
});

export const PermissionListParams = z.object({
  active: z.boolean().optional(),
});

export interface PermissionDomain {
  'permission.request': {
    params: z.infer<typeof PermissionRequestParams>;
    result: PermissionRequest;
  };
  'permission.grant': {
    params: z.infer<typeof PermissionGrantParams>;
    result: PermissionGrant;
  };
  'permission.revoke': {
    params: z.infer<typeof PermissionRevokeParams>;
    result: { revoked: true };
  };
  'permission.list': {
    params: z.infer<typeof PermissionListParams>;
    result: { grants: PermissionRule[] };
  };
}
