import { Injectable } from '@nestjs/common';
import type { Message, Project, ProviderKind, Session, ToolCall, ToolName, PermissionLevel, RunStatus } from '@openwork/contracts';
import { randomUUID } from 'node:crypto';

type Provider = { id: string; name: string; kind: ProviderKind; baseUrl?: string; hasKey: boolean; defaultModel?: string; fallbackProviderId?: string; pricing: Record<string, number>; isEnabled: boolean; createdAt: string; updatedAt: string };
type ConfigEntry = { scope: 'global'|'project'|'session'; refId?: string; key: string; value: unknown; updatedAt: string };

@Injectable()
export class MemoryStore {
  readonly projects = new Map<string, Project>(); readonly sessions = new Map<string, Session>(); readonly messages = new Map<string, Message>();
  readonly providers = new Map<string, Provider>(); readonly toolCalls = new Map<string, ToolCall>(); readonly configs = new Map<string, ConfigEntry>();
  readonly todos = new Map<string, unknown[]>();
  readonly configHistory: Array<ConfigEntry & { id: number; oldValue: unknown; changeSource: string; changedAt: string }> = [];
  private seq = 0;
  constructor() { this.providers.set('demo-provider', { id: 'demo-provider', name: 'Demo Provider', kind: 'ollama', hasKey: false, defaultModel: 'demo', pricing: {}, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); }
  createProject(input: { name: string; rootPath: string; description?: string }): Project { const now = new Date().toISOString(); const project: Project = { id: randomUUID(), ...input, status: 'active', sessionCount: 0, createdAt: now, updatedAt: now }; this.projects.set(project.id, project); return project; }
  createSession(projectId: string, input: { title?: string; providerId?: string; modelLabel?: string; maxSteps?: number; tokenBudget?: number }): Session { const now = new Date().toISOString(); const session: Session = { id: randomUUID(), projectId, title: input.title ?? 'New Session', status: 'active', ...(input.modelLabel ? { modelLabel: input.modelLabel } : {}), maxSteps: input.maxSteps ?? 40, ...(input.tokenBudget ? { tokenBudget: input.tokenBudget } : {}), totalPromptTokens: 0, totalCompletionTokens: 0, totalCostUsd: 0, lastActivityAt: now, createdAt: now, updatedAt: now }; this.sessions.set(session.id, session); const p = this.projects.get(projectId); if (p) this.projects.set(projectId, { ...p, sessionCount: p.sessionCount + 1, updatedAt: now }); return session; }
  addMessage(sessionId: string, role: Message['role'], content: string, parentMessageId?: string, editedFromMessageId?: string, status: Message['status'] = 'complete'): Message { const now = new Date().toISOString(); const msg: Message = { id: randomUUID(), sessionId, seq: ++this.seq, role, content, status, createdAt: now, ...(parentMessageId ? { parentMessageId } : {}), ...(editedFromMessageId ? { editedFromMessageId } : {}) }; this.messages.set(msg.id, msg); return msg; }
  listMessages(sessionId: string) { return [...this.messages.values()].filter((m) => m.sessionId === sessionId).sort((a,b) => a.seq - b.seq); }
  setSession(sessionId: string, patch: Partial<Pick<Session, 'title'|'status'>>) { const s = this.sessions.get(sessionId); if (!s) return undefined; const updated = { ...s, ...patch, updatedAt: new Date().toISOString() }; this.sessions.set(sessionId, updated); return updated; }
  addToolCall(sessionId: string, toolName: ToolName, permissionLevel: PermissionLevel, input: unknown, status: RunStatus = 'succeeded'): ToolCall { const call: ToolCall = { id: randomUUID(), sessionId, toolName, permissionLevel, status, input }; this.toolCalls.set(call.id, call); return call; }
  updateToolCall(id: string, patch: Partial<ToolCall>) { const call = this.toolCalls.get(id); if (!call) return undefined; const updated = { ...call, ...patch }; this.toolCalls.set(id, updated); return updated; }
  setTodos(sessionId: string, items: unknown[]) { this.todos.set(sessionId, items); return items; }
  upsertConfig(scope: ConfigEntry['scope'], key: string, value: unknown, refId?: string) { const id = `${scope}:${refId ?? ''}:${key}`; const old = this.configs.get(id); const now = new Date().toISOString(); const entry: ConfigEntry = { scope, key, value, updatedAt: now, ...(refId ? { refId } : {}) }; this.configs.set(id, entry); this.configHistory.push({ ...entry, id: this.configHistory.length + 1, oldValue: old?.value ?? null, changeSource: 'ui', changedAt: now }); return entry; }
  resolvedConfig(scope?: ConfigEntry['scope'], refId?: string) { const result: Record<string, unknown> = {}; for (const e of this.configs.values()) { if (e.scope === 'global' || (e.scope === 'project' && scope !== 'global' && e.refId === refId) || (e.scope === 'session' && scope === 'session' && e.refId === refId)) result[e.key] = e.value; } return result; }
}
