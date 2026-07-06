/**
 * MCP 域 — MCP Server 管理
 * 对应 06-详细设计文档 §4.2.7
 *
 * v0.1: MCP 配置复用 configs 表 (key=mcp.servers),持久化在 v0.2 引入 mcp_servers 表
 */
import { z } from 'zod';
import type { ToolDef } from '../types.js';

export const McpListParams = z.object({
  health: z.boolean().optional(),
});

export const McpAddParams = z.object({
  name: z.string().min(1),
  transport: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
});

export const McpRemoveParams = z.object({
  serverId: z.string().min(1),
});

export const McpHealthParams = z.object({
  serverId: z.string().optional(),
});

export const McpToolsParams = z.object({
  serverId: z.string().min(1),
});

export interface McpServer {
  id: string;
  name: string;
  transport: 'stdio' | 'sse' | 'http';
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  tools?: number;
  lastHealthCheck?: number;
}

export interface McpHealthStatus {
  serverId: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  latencyMs?: number;
  lastError?: string;
}

export interface McpDomain {
  'mcp.list': {
    params: z.infer<typeof McpListParams>;
    result: { servers: McpServer[] };
  };
  'mcp.add': {
    params: z.infer<typeof McpAddParams>;
    result: { serverId: string; status: string };
  };
  'mcp.remove': {
    params: z.infer<typeof McpRemoveParams>;
    result: { removed: true };
  };
  'mcp.health': {
    params: z.infer<typeof McpHealthParams>;
    result: { servers: McpHealthStatus[] };
  };
  'mcp.tools': {
    params: z.infer<typeof McpToolsParams>;
    result: { tools: ToolDef[] };
  };
}
