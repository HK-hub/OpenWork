/**
 * BackendServiceHost — 后端服务宿主
 *
 * 对应 04-架构设计文档 v4.2 §6.1 Backend Service Host 设计
 *      06-详细设计文档 v4.2 §3.0 模块映射表
 *
 * 装配:
 *  - CoreEngine (Agent / Tool / Permission / MCP / DB / Event)
 *  - Router (JSON-RPC 方法分发)
 *  - TransportServer (Embedded / IPC / stdio / HTTP / WS)
 *  - Handlers (各域方法实现)
 *
 * 生命周期:
 *  - start(): 初始化 → 注册 handlers → 启动 transport
 *  - stop(): 关闭 transport → 关闭 core
 */
import type { CoreEngine } from '@opencode/core';
import { Router } from './router.js';
import type { TransportServer } from './transports/types.js';
import { registerSessionHandlers } from './handlers/session.handlers.js';
import { registerAgentHandlers } from './handlers/agent.handlers.js';
import { registerToolHandlers } from './handlers/tool.handlers.js';
import { registerConfigHandlers } from './handlers/config.handlers.js';
import { registerProfileHandlers } from './handlers/profile.handlers.js';
import { registerPermissionHandlers } from './handlers/permission.handlers.js';
import {
  registerMcpHandlers,
  registerMemoryHandlers,
  registerAuditHandlers,
  registerModelHandlers,
} from './handlers/mcp.handlers.js';
import { moduleLogger, getEventBus } from '@opencode/core';

const log = moduleLogger('BackendServiceHost');

export interface BackendOptions {
  core: CoreEngine;
  transport: TransportServer;
  /** 是否自动注册所有 handler (默认 true) */
  autoRegister?: boolean;
}

export class BackendServiceHost {
  readonly router: Router;
  private started = false;

  constructor(private opts: BackendOptions) {
    this.router = new Router();
    if (opts.autoRegister !== false) {
      this.registerHandlers();
    }
  }

  /** 注册所有 handlers (各域方法) */
  registerHandlers(): void {
    const { core, transport } = this.opts;
    const db = core.getDb();

    // 注册到 router
    registerSessionHandlers(this.router, db!);
    registerAgentHandlers(this.router, core);
    registerToolHandlers(this.router, core);
    registerConfigHandlers(this.router, core, db);
    registerProfileHandlers(this.router, db);
    registerPermissionHandlers(this.router, core);
    registerMcpHandlers(this.router, core);
    registerMemoryHandlers(this.router, db);
    registerAuditHandlers(this.router, db);
    registerModelHandlers(this.router);

    log.info('handlers registered', { methods: this.router.listMethods().length });

    // 将 router handlers 转发给 transport
    for (const method of this.router.listMethods()) {
      const handler = this.router.get(method)!;
      transport.handle(method, async (req, ctx) => handler(req, ctx));
    }

    // EventBus → Transport 推送 (后端事件 → 前端)
    const bus = getEventBus();
    bus.onAll((type, event) => {
      transport.broadcast(type, event);
    });
  }

  /** 启动后端服务 */
  async start(): Promise<void> {
    if (this.started) {
      log.warn('BackendServiceHost already started');
      return;
    }
    log.info('BackendServiceHost starting...');
    await this.opts.transport.start();
    this.started = true;
    log.info('BackendServiceHost started', {
      transport: this.opts.transport.kind,
      methods: this.router.listMethods().length,
    });
  }

  /** 停止后端服务 */
  async stop(): Promise<void> {
    if (!this.started) return;
    log.info('BackendServiceHost stopping...');
    await this.opts.transport.stop();
    this.started = false;
    log.info('BackendServiceHost stopped');
  }

  /** 是否已启动 */
  isStarted(): boolean {
    return this.started;
  }

  /** 获取已注册方法列表 */
  listMethods(): string[] {
    return this.router.listMethods();
  }
}
