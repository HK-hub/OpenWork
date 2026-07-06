/**
 * @opencode/api — OpenCoding JSON-RPC API 契约层
 *
 * 前后端共享的协议定义、类型、Zod schema、客户端 SDK。
 * 零运行时依赖 (仅 zod)。
 *
 * 对应 04-架构设计文档 v4.2 §3 L3 API 契约层
 *      06-详细设计文档 v4.2 §4 API 接口清单
 */
export * from './protocol.js';
export * from './errors.js';
export * from './types.js';
export * from './events.js';
export * from './client.js';

// 域方法签名 (按需导入,避免命名冲突)
export * as SessionDomain from './domains/session.js';
export * as AgentDomain from './domains/agent.js';
export * as ToolDomain from './domains/tool.js';
export * as ConfigDomain from './domains/config.js';
export * as ProfileDomain from './domains/profile.js';
export * as PermissionDomain from './domains/permission.js';
export * as McpDomain from './domains/mcp.js';
export * as MemoryDomain from './domains/memory.js';
export * as AuditDomain from './domains/audit.js';
export * as ModelDomain from './domains/model.js';

// v0.2+ 占位域 (仅类型导出,无运行时值)
export type {
  SkillDomain,
  PluginDomain,
  HookDomain,
  SubagentDomain,
  IndexDomain,
} from './domains/index.js';

// 版本信息
export const API_VERSION = '0.1.0';
