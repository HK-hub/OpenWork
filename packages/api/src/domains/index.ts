/**
 * v0.2+ 占位域 — Skill / Plugin / Hook / Subagent / Index
 *
 * 这些域在 v0.1 不实现具体方法,但保留类型接口以便 v0.2+ 扩展。
 * v0.1 后端 BackendServiceHost 对这些方法返回 -32601 Method not found。
 */

export interface SkillDomain {
  'skill.list': { params: unknown; result: { skills: unknown[] } };
  'skill.invoke': { params: unknown; result: { runId: string; output: unknown } };
  'skill.install': { params: unknown; result: { skillId: string; version: string } };
  'skill.uninstall': { params: unknown; result: { removed: true } };
}

export interface PluginDomain {
  'plugin.list': { params: unknown; result: { plugins: unknown[] } };
  'plugin.install': { params: unknown; result: { pluginId: string; version: string } };
  'plugin.enable': { params: unknown; result: { enabled: true } };
  'plugin.disable': { params: unknown; result: { disabled: true } };
  'plugin.invoke': { params: unknown; result: { result: unknown } };
}

export interface HookDomain {
  'hook.list': { params: unknown; result: { hooks: unknown[] } };
  'hook.add': { params: unknown; result: { hookId: string } };
  'hook.remove': { params: unknown; result: { removed: true } };
  'hook.test': { params: unknown; result: { results: unknown[] } };
}

export interface SubagentDomain {
  'subagent.spawn': {
    params: unknown;
    result: { subAgentId: string; status: string };
  };
  'subagent.list': { params: unknown; result: { items: unknown[] } };
  'subagent.kill': { params: unknown; result: { killed: true } };
  'subagent.message': { params: unknown; result: { delivered: true } };
}

export interface IndexDomain {
  'index.status': { params: unknown; result: { state: string; indexed: number; pending: number } };
  'index.rebuild': { params: unknown; result: { jobId: string } };
  'index.query': { params: unknown; result: { nodes: unknown[] } };
  'index.search': { params: unknown; result: { hits: unknown[] } };
}
