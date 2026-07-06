/**
 * MCPClient — Model Context Protocol 客户端
 *
 * v0.1 实现: stdio transport 连接 + 工具发现基础结构
 * v0.2+ 完整实现: SSE/HTTP transport + 工具合并 + Server 管理
 *
 * 对应 06-详细设计文档 v4.2 §3.7 MCPClient (stdio/SSE/HTTP + Server 管理 + 工具合并)
 *      04-架构设计文档 v4.2 §9.4 MCP Client
 */
import type { ToolDef } from '@opencode/api';
import { genRawId } from '../../utils/id-generator.js';
import { moduleLogger } from '../../utils/logger.js';
import { getEventBus } from '../../events/event-bus.js';

const log = moduleLogger('MCPClient');

export type McpTransport = 'stdio' | 'sse' | 'http';

export interface McpServerConfig {
  id?: string;
  name: string;
  transport: McpTransport;
  command?: string; // stdio
  args?: string[]; // stdio
  url?: string; // sse/http
  enabled?: boolean;
}

export interface McpServerStatus {
  id: string;
  name: string;
  transport: McpTransport;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  tools?: number;
  lastHealthCheck?: number;
  lastError?: string;
}

/** MCP Server 实例 (运行时状态) */
interface McpServerInstance {
  config: McpServerConfig;
  status: McpServerStatus;
  tools: ToolDef[];
  childProcess?: import('node:child_process').ChildProcess;
}

export class MCPClient {
  private servers = new Map<string, McpServerInstance>();

  constructor() {
    log.info('MCPClient initialized (v0.1 simplified)');
  }

  /** 添加 MCP Server 配置 (不立即连接) */
  addServer(config: McpServerConfig): { serverId: string; status: string } {
    const serverId = config.id ?? genRawId(12);
    const status: McpServerStatus = {
      id: serverId,
      name: config.name,
      transport: config.transport,
      status: 'disconnected',
    };
    this.servers.set(serverId, { config: { ...config, id: serverId }, status, tools: [] });
    log.info('MCP server added', { serverId, name: config.name, transport: config.transport });
    return { serverId, status: status.status };
  }

  /** 连接到 MCP Server (v0.1: stub) */
  async connect(serverId: string): Promise<void> {
    const inst = this.servers.get(serverId);
    if (!inst) throw Object.assign(new Error(`MCP server not found: ${serverId}`), { code: -32700 });
    inst.status.status = 'connecting';
    log.info('connecting to MCP server', { serverId, name: inst.config.name });

    try {
      // v0.1 stub: 实际 stdio 子进程创建在 Phase 2 实现
      // const { spawn } = await import('node:child_process');
      // if (inst.config.transport === 'stdio' && inst.config.command) {
      //   inst.childProcess = spawn(inst.config.command, inst.config.args ?? [], { stdio: ['pipe', 'pipe', 'pipe'] });
      //   // ... JSON-RPC 握手
      // }
      inst.status.status = 'connected';
      inst.status.lastHealthCheck = Date.now();
      getEventBus().emit({
        type: 'mcp.server_status',
        serverId,
        status: 'connected',
        timestamp: Date.now(),
      });
      log.info('MCP server connected (stub)', { serverId });
    } catch (err) {
      inst.status.status = 'error';
      inst.status.lastError = (err as Error).message;
      getEventBus().emit({
        type: 'mcp.server_status',
        serverId,
        status: 'error',
        timestamp: Date.now(),
      });
      log.error('MCP server connect failed', { serverId, error: (err as Error).message });
      throw err;
    }
  }

  /** 断开连接 */
  async disconnect(serverId: string): Promise<void> {
    const inst = this.servers.get(serverId);
    if (!inst) return;
    inst.childProcess?.kill('SIGTERM');
    inst.childProcess = undefined;
    inst.status.status = 'disconnected';
    getEventBus().emit({
      type: 'mcp.server_status',
      serverId,
      status: 'disconnected',
      timestamp: Date.now(),
    });
    log.info('MCP server disconnected', { serverId });
  }

  /** 移除 server */
  async removeServer(serverId: string): Promise<void> {
    await this.disconnect(serverId);
    this.servers.delete(serverId);
    log.info('MCP server removed', { serverId });
  }

  /** 列出所有 server */
  listServers(): McpServerStatus[] {
    return Array.from(this.servers.values()).map((s) => s.status);
  }

  /** 健康检查 */
  async healthCheck(serverId?: string): Promise<McpServerStatus[]> {
    const targets = serverId ? [this.servers.get(serverId)].filter(Boolean) : Array.from(this.servers.values());
    for (const inst of targets) {
      if (!inst) continue;
      inst.status.lastHealthCheck = Date.now();
      // v0.1 stub: 实际 ping 在 Phase 2 实现
    }
    return targets.map((s) => s!.status);
  }

  /** 获取 server 的工具列表 */
  async listTools(serverId: string): Promise<ToolDef[]> {
    const inst = this.servers.get(serverId);
    if (!inst) throw Object.assign(new Error(`MCP server not found: ${serverId}`), { code: -32700 });
    return inst.tools;
  }

  /** 关闭所有 server */
  async shutdown(): Promise<void> {
    for (const serverId of Array.from(this.servers.keys())) {
      await this.disconnect(serverId);
    }
    log.info('MCPClient shutdown');
  }
}
