/**
 * @opencode/core — OpenCoding Agent 核心引擎
 *
 * Headless 后端核心,无 Electron 依赖。提供:
 *  - Agent Loop Engine (PAOR 循环)
 *  - Tool Registry + 内置工具
 *  - Permission Gateway (HITL)
 *  - MCP Client
 *  - EventBus (事件总线)
 *  - DB 层 (better-sqlite3)
 *
 * 对应 04-架构设计文档 v4.2 §3 L5-L7 后端核心层
 */
export * from './utils/index.js';
export * from './events/index.js';
export * from './config/config-loader.js';
export * from './agent/index.js';
export * from './tools/index.js';
export * from './permission/index.js';
export * from './providers/index.js';

// 数据库层 (Phase 0.4)
export * from './db/index.js';

import { LoopEngine } from './agent/loop-engine.js';
import { ToolRegistry } from './tools/registry.js';
import { registerBuiltinTools } from './tools/builtin/index.js';
import { MCPClient } from './tools/mcp/mcp-client.js';
import type { McpServerConfig } from './tools/mcp/mcp-client.js';
import { PermissionGateway } from './permission/gateway.js';
import { getEventBus } from './events/event-bus.js';
import { getLogger, moduleLogger, configureLogger } from './utils/logger.js';
import { loadConfig, type AppConfig } from './config/config-loader.js';
import type { Logger } from 'winston';
import { type Database } from './db/index.js';
import { openDatabase } from './db/connection.js';
import { ProviderRouter, createProviderRouter } from './providers/index.js';
import type { ProviderKind } from './providers/index.js';

const log = moduleLogger('Core');

/**
 * CoreEngine — 后端核心引擎编排器
 *
 * 装配各模块 (Loop / Tool / Permission / MCP / DB / Event),
 * 由 BackendServiceHost (packages/server) 嵌入或独立启动。
 */
export class CoreEngine {
  readonly loopEngine: LoopEngine;
  readonly toolRegistry: ToolRegistry;
  readonly permissionGateway: PermissionGateway;
  readonly mcpClient: MCPClient;
  readonly providerRouter: ProviderRouter;
  readonly eventBus = getEventBus();
  readonly config: AppConfig;
  readonly logger: Logger;

  private db: Database | null = null;
  private started = false;

  constructor(opts: { config?: AppConfig; userDataDir?: string } = {}) {
    this.config = opts.config ?? loadConfig({ userDataDir: opts.userDataDir });
    this.logger = configureLogger({ level: this.config.logging.level });

    // 装配 ProviderRouter (Phase 1.2)
    this.providerRouter = createProviderRouter({
      defaultProvider: this.config.model.provider as ProviderKind,
      providersConfig: this.config.model.providers as Record<string, { apiKey: string; baseUrl: string }>,
    });

    // 装配模块
    this.toolRegistry = new ToolRegistry();
    this.permissionGateway = new PermissionGateway({
      autoApproveLowRisk: this.config.agent.autoApproveLowRisk,
    });
    this.mcpClient = new MCPClient();
    this.loopEngine = new LoopEngine({
      toolRegistry: this.toolRegistry,
      permissionGateway: this.permissionGateway,
      callModel: (req) => this.providerRouter.stream(req),
      defaultModel: this.config.model.name,
      defaultProvider: this.config.model.provider,
      maxIterations: this.config.agent.maxIterations,
    });

    log.info('CoreEngine created', {
      transport: this.config.server.transport,
      maxIterations: this.config.agent.maxIterations,
      defaultModel: this.config.model.name,
      defaultProvider: this.config.model.provider,
      providersReady: this.providerRouter.isReady(),
    });
  }

  /** 启动 CoreEngine */
  async start(): Promise<void> {
    if (this.started) {
      log.warn('CoreEngine already started');
      return;
    }
    log.info('CoreEngine starting...');

    // 注册内置工具
    registerBuiltinTools(this.toolRegistry);

    // 打开数据库
    if (this.config.database.path) {
      this.db = openDatabase({ path: this.config.database.path, walMode: this.config.database.walMode });
      log.info('database opened', { path: this.config.database.path });
    } else {
      log.warn('database path not set, running without persistence');
    }

    // 加载 MCP servers 配置 (v0.1 简化: 仅注册,不自动连接)
    for (const server of this.config.mcp.servers) {
      this.mcpClient.addServer({
        name: server.name,
        transport: server.transport as McpServerConfig['transport'],
        command: server.command,
        args: server.args,
        url: server.url,
        enabled: true,
      });
    }

    this.started = true;
    log.info('CoreEngine started', {
      tools: this.toolRegistry.list().length,
      mcpServers: this.mcpClient.listServers().length,
    });
  }

  /** 停止 CoreEngine */
  async stop(): Promise<void> {
    if (!this.started) return;
    log.info('CoreEngine stopping...');

    await this.mcpClient.shutdown();
    this.toolRegistry.clear();
    this.eventBus.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('database closed');
    }

    this.started = false;
    log.info('CoreEngine stopped');
  }

  /** 获取数据库 (可能为 null,如果未配置路径) */
  getDb(): Database | null {
    return this.db;
  }

  /** 是否已启动 */
  isStarted(): boolean {
    return this.started;
  }
}

/** 创建 CoreEngine 单例 (供 Electron Main 嵌入式使用) */
let globalCore: CoreEngine | null = null;

export async function createCore(opts?: { userDataDir?: string; config?: AppConfig }): Promise<CoreEngine> {
  if (!globalCore) {
    globalCore = new CoreEngine(opts ?? {});
    await globalCore.start();
  }
  return globalCore;
}

export function getCore(): CoreEngine {
  if (!globalCore) throw new Error('CoreEngine not created, call createCore() first');
  return globalCore;
}

export async function shutdownCore(): Promise<void> {
  if (globalCore) {
    await globalCore.stop();
    globalCore = null;
  }
}
