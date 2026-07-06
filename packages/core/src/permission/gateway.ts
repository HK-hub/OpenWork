/**
 * PermissionGateway — 权限网关
 *
 * v0.1 实现: L0-L3 风险等级 + 内存缓存 + 自动批准低风险
 *
 * 对应 06-详细设计文档 v4.2 §3.5 PermissionGateway (L0-L3 + 审批缓存 + dry-run)
 *      04-架构设计文档 v4.2 §13.2 Permission Gateway
 */
import type {
  PermissionRequest,
  PermissionRule,
  PermissionScope,
  PermissionDecision,
  ID,
} from '@opencode/api';
import { genPermissionId, genApprovalToken } from '../utils/id-generator.js';
import { moduleLogger } from '../utils/logger.js';
import { getEventBus } from '../events/event-bus.js';

const log = moduleLogger('PermissionGateway');

/** 审批缓存条目 */
interface ApprovalCacheEntry {
  approvalToken: string;
  scope: PermissionScope;
  resource: string;
  decision: PermissionDecision;
  expiresAt: number;
  createdAt: number;
}

/** 决策回调 (用于 HITL: 等待用户审批) */
export type ApprovalCallback = (req: PermissionRequest) => Promise<'allow' | 'deny'>;

export interface PermissionGatewayOptions {
  /** 是否自动批准 L0/L1 (低风险) */
  autoApproveLowRisk?: boolean;
  /** 默认 TTL (秒) */
  defaultTtl?: number;
}

export class PermissionGateway {
  /** 已注册的规则 (按 scope+resource 匹配) */
  private rules: PermissionRule[] = [];
  /** 审批缓存 (approvalToken → entry) */
  private approvalCache = new Map<string, ApprovalCacheEntry>();
  /** 待审批请求 (approvalToken → request) */
  private pendingRequests = new Map<string, PermissionRequest>();
  /** 用户审批回调 */
  private approvalCallback?: ApprovalCallback;

  constructor(private opts: PermissionGatewayOptions = {}) {
    log.info('PermissionGateway initialized', {
      autoApproveLowRisk: opts.autoApproveLowRisk ?? true,
      defaultTtl: opts.defaultTtl ?? 3600,
    });
  }

  /** 注册用户审批回调 (HITL) */
  setApprovalCallback(cb: ApprovalCallback): void {
    this.approvalCallback = cb;
    log.debug('approval callback registered');
  }

  /** 添加权限规则 */
  addRule(rule: Omit<PermissionRule, 'id' | 'createdAt'>): PermissionRule {
    const full: PermissionRule = {
      ...rule,
      id: genPermissionId(),
      createdAt: Date.now(),
    };
    this.rules.push(full);
    log.info('rule added', { scope: rule.scope, resource: rule.resource, decision: rule.decision });
    return full;
  }

  /** 请求权限 (返回 approvalToken,需要等待 grant) */
  async request(scope: PermissionScope, resource: string, ttl?: number): Promise<PermissionRequest> {
    // 1. 先查缓存
    const cached = this.findCachedApproval(scope, resource);
    if (cached) {
      log.debug('cache hit', { scope, resource });
      return {
        approvalToken: cached.approvalToken,
        scope,
        resource,
        ttl: cached.expiresAt - Date.now(),
        expiresAt: cached.expiresAt,
      };
    }

    // 2. 查规则
    const rule = this.findRule(scope, resource);
    if (rule?.decision === 'allow') {
      const token = genApprovalToken();
      this.approvalCache.set(token, {
        approvalToken: token,
        scope,
        resource,
        decision: 'allow',
        expiresAt: Date.now() + (ttl ?? this.opts.defaultTtl ?? 3600) * 1000,
        createdAt: Date.now(),
      });
      return { approvalToken: token, scope, resource, ttl: ttl ?? 3600, expiresAt: Date.now() + (ttl ?? 3600) * 1000 };
    }
    if (rule?.decision === 'deny') {
      const err = Object.assign(new Error(`Permission denied: ${scope}/${resource}`), { code: -32200 });
      throw err;
    }

    // 3. 规则未定义,触发 HITL (等待用户审批)
    const token = genApprovalToken();
    const request: PermissionRequest = {
      approvalToken: token,
      scope,
      resource,
      ttl: ttl ?? this.opts.defaultTtl ?? 3600,
      expiresAt: Date.now() + (ttl ?? this.opts.defaultTtl ?? 3600) * 1000,
    };
    this.pendingRequests.set(token, request);

    getEventBus().emit({
      type: 'permission.requested',
      approvalToken: token,
      scope,
      resource,
      expiresAt: request.expiresAt,
      timestamp: Date.now(),
    });

    log.info('permission requested, waiting for approval', { scope, resource });
    return request;
  }

  /** 同步检查是否有权限 (用于自动决策,不触发 HITL) */
  check(scope: PermissionScope, resource: string, riskLevel: 'L0' | 'L1' | 'L2' | 'L3'): 'allow' | 'deny' | 'ask' {
    // L0 自动允许
    if (riskLevel === 'L0' && this.opts.autoApproveLowRisk !== false) return 'allow';
    // 查缓存
    if (this.findCachedApproval(scope, resource)) return 'allow';
    // 查规则
    const rule = this.findRule(scope, resource);
    if (rule) return rule.decision;
    // L1 默认 ask (除非配置 autoApprove)
    if (riskLevel === 'L1' && this.opts.autoApproveLowRisk) return 'allow';
    return 'ask';
  }

  /** 授予权限 (用户审批通过) */
  async grant(approvalToken: string, scope?: string): Promise<void> {
    const req = this.pendingRequests.get(approvalToken);
    if (!req) {
      const err = Object.assign(new Error(`Approval token not found: ${approvalToken}`), { code: -32201 });
      throw err;
    }
    this.pendingRequests.delete(approvalToken);
    this.approvalCache.set(approvalToken, {
      approvalToken,
      scope: req.scope,
      resource: req.resource,
      decision: 'allow',
      expiresAt: req.expiresAt,
      createdAt: Date.now(),
    });
    getEventBus().emit({
      type: 'permission.decided',
      approvalToken,
      decision: 'allow',
      decidedBy: 'user',
      timestamp: Date.now(),
    });
    log.info('permission granted', { scope: req.scope, resource: req.resource });
  }

  /** 撤销审批 */
  async revoke(approvalToken: string): Promise<void> {
    this.approvalCache.delete(approvalToken);
    this.pendingRequests.delete(approvalToken);
    log.info('permission revoked', { approvalToken });
  }

  /** 列出权限规则 / 缓存 */
  list(active?: boolean): { rules: PermissionRule[]; grants: PermissionRule[] } {
    return {
      rules: this.rules,
      grants: Array.from(this.approvalCache.values()).map((e) => ({
        id: e.approvalToken,
        scope: e.scope,
        resource: e.resource,
        decision: e.decision,
        ttl: Math.max(0, Math.floor((e.expiresAt - Date.now()) / 1000)),
        createdAt: e.createdAt,
      })),
    };
  }

  /** 清理过期缓存 (定期调用) */
  cleanup(): void {
    const now = Date.now();
    for (const [token, entry] of this.approvalCache) {
      if (entry.expiresAt <= now) {
        this.approvalCache.delete(token);
        log.debug('expired approval removed', { token });
      }
    }
  }

  private findCachedApproval(scope: PermissionScope, resource: string): ApprovalCacheEntry | undefined {
    const now = Date.now();
    return Array.from(this.approvalCache.values()).find(
      (e) => e.scope === scope && (e.resource === resource || e.resource === '*') && e.expiresAt > now,
    );
  }

  private findRule(scope: PermissionScope, resource: string): PermissionRule | undefined {
    // 精确匹配优先,然后通配符 *
    return (
      this.rules.find((r) => r.scope === scope && r.resource === resource) ??
      this.rules.find((r) => r.scope === scope && r.resource === '*')
    );
  }
}
