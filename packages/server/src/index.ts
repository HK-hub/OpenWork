/**
 * @opencode/server — OpenCoding 后端服务宿主
 *
 * 提供:
 *  - Transport 层 (Embedded / IPC / stdio / HTTP / WS)
 *  - JSON-RPC 路由器
 *  - BackendServiceHost (服务编排)
 *  - 各域 handlers (session / agent / tool / config / profile / permission / mcp / memory / audit / model)
 *
 * 对应 04-架构设计文档 v4.2 §6 后端服务架构
 */
export * from './transports/index.js';
export * from './router.js';
export * from './host.js';
export * from './handlers/session.handlers.js';
export * from './handlers/agent.handlers.js';
export * from './handlers/tool.handlers.js';
export * from './handlers/config.handlers.js';
export * from './handlers/profile.handlers.js';
export * from './handlers/permission.handlers.js';
export * from './handlers/mcp.handlers.js';

import { EmbeddedTransport } from './transports/embedded.js';
import type { TransportServer } from './transports/types.js';
import { BackendServiceHost } from './host.js';
import type { CoreEngine } from '@opencode/core';
import { moduleLogger } from '@opencode/core';

const log = moduleLogger('ServerIndex');

/** 创建嵌入式后端 (Desktop 默认模式) */
export async function createEmbeddedBackend(core: CoreEngine): Promise<BackendServiceHost> {
  const transport = new EmbeddedTransport();
  const host = new BackendServiceHost({ core, transport });
  await host.start();
  log.info('embedded backend created', { methods: host.listMethods().length });
  return host;
}

/** 创建指定 Transport 的后端 */
export async function createBackend(core: CoreEngine, transport: TransportServer): Promise<BackendServiceHost> {
  const host = new BackendServiceHost({ core, transport });
  await host.start();
  return host;
}
