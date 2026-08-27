import { Inject, Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { PERMISSION_LEVEL, RUN_STATUS, TOOL_METADATA, TOOL_NAMES, type PermissionLevel, type ToolName } from '@openwork/contracts';
import { MemoryStore } from './store.js';
import { WorkspaceService } from './workspace.js';

const execFileAsync = promisify(execFile);
type ToolResult = { id: string; status: 'pending_approval' | 'succeeded' | 'failed'; output?: unknown; errorText?: string };

@Injectable()
export class ToolExecutor {
  private readonly pending = new Map<string, { sessionId: string; toolName: ToolName; input: unknown }>();
  constructor(@Inject(MemoryStore) private readonly store: MemoryStore, @Inject(WorkspaceService) private readonly workspace: WorkspaceService) {}

  async execute(sessionId: string, toolName: ToolName, input: unknown): Promise<ToolResult> {
    const permission = TOOL_METADATA[toolName].permissionLevel;
    const call = this.store.addToolCall(sessionId, toolName, permission, input, permission === PERMISSION_LEVEL.L2 || permission === PERMISSION_LEVEL.L3 ? RUN_STATUS.PendingApproval : RUN_STATUS.Running);
    if (permission === PERMISSION_LEVEL.L2 || permission === PERMISSION_LEVEL.L3) {
      this.pending.set(call.id, { sessionId, toolName, input });
      return { id: call.id, status: 'pending_approval' };
    }
    return this.run(call.id, sessionId, toolName, input);
  }

  async approve(toolCallId: string, approved: boolean, scope: 'once' | 'session') {
    const pending = this.pending.get(toolCallId);
    if (!pending) return this.store.updateToolCall(toolCallId, { status: approved ? RUN_STATUS.Approved : RUN_STATUS.Rejected, approvalScope: scope, approvedByUser: true });
    this.pending.delete(toolCallId);
    if (!approved) return this.store.updateToolCall(toolCallId, { status: RUN_STATUS.Rejected, approvalScope: scope, approvedByUser: true });
    return this.run(toolCallId, pending.sessionId, pending.toolName, pending.input, scope);
  }

  private async run(id: string, sessionId: string, toolName: ToolName, input: unknown, scope?: 'once' | 'session'): Promise<ToolResult> {
    const started = Date.now();
    try {
      const output = await this.dispatch(sessionId, toolName, input);
      this.store.updateToolCall(id, { status: RUN_STATUS.Succeeded, output, durationMs: Date.now() - started, ...(scope ? { approvalScope: scope, approvedByUser: true } : {}) });
      return { id, status: 'succeeded', output };
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      this.store.updateToolCall(id, { status: RUN_STATUS.Failed, errorText, durationMs: Date.now() - started });
      return { id, status: 'failed', errorText };
    }
  }

  private async dispatch(sessionId: string, toolName: ToolName, input: unknown): Promise<unknown> {
    const args = input as Record<string, unknown>;
    const session = this.store.sessions.get(sessionId);
    const projectRoot = session ? this.store.projects.get(session.projectId)?.rootPath : undefined;
    const resolvePath = (value: unknown, fallback = projectRoot) => {
      const raw = String(value ?? '');
      return fallback && !path.isAbsolute(raw) ? path.resolve(fallback, raw) : raw;
    };
    switch (toolName) {
      case TOOL_NAMES.ReadFile: return this.workspace.readFile(resolvePath(args.path));
      case TOOL_NAMES.WriteFile: return this.workspace.writeFile(resolvePath(args.path), String(args.content));
      case TOOL_NAMES.EditFile: {
        const filePath = resolvePath(args.path); const current = await this.workspace.readFile(filePath); const find = String(args.find); const replace = String(args.replace); if (!current.includes(find)) throw new Error('Text to edit was not found'); return this.workspace.writeFile(filePath, current.replace(find, replace));
      }
      case TOOL_NAMES.DeleteFile: { const filePath = resolvePath(args.path); await this.workspace.deleteFile(filePath); return { deleted: filePath }; }
      case TOOL_NAMES.MoveFile: { const from = resolvePath(args.from); const to = resolvePath(args.to); await this.workspace.moveFile(from, to); return { from, to }; }
      case TOOL_NAMES.Glob: return this.workspace.glob(String(args.pattern ?? ''), resolvePath(args.cwd));
      case TOOL_NAMES.Grep: {
        const root = resolvePath(args.cwd); const pattern = String(args.pattern); const files = await this.workspace.glob('', root); const matches: Array<{ path: string; line: number; text: string }> = []; for (const file of files) { try { const content = await this.workspace.readFile(file); content.split(/\r?\n/).forEach((line, index) => { if (line.includes(pattern)) matches.push({ path: file, line: index + 1, text: line }); }); } catch { /* ignore unreadable entries */ } } return matches;
      }
      case TOOL_NAMES.RunCommand: {
        const command = String(args.command); const cwd = this.workspace.assertAllowed(resolvePath(args.cwd)); const timeout = Number(args.timeoutMs ?? 30_000); const result = await execFileAsync(process.platform === 'win32' ? 'cmd.exe' : 'sh', process.platform === 'win32' ? ['/d', '/s', '/c', command] : ['-lc', command], { cwd, timeout, windowsHide: true, env: { ...process.env, CI: 'true', TERM: 'dumb' }, maxBuffer: 64 * 1024 }); return { stdout: result.stdout, stderr: result.stderr };
      }
      case TOOL_NAMES.WebFetch: { const response = await fetch(String(args.url)); if (!response.ok) throw new Error(`HTTP ${response.status}`); return (await response.text()).slice(0, 64 * 1024); }
      case TOOL_NAMES.TodoWrite: return this.store.setTodos(sessionId, Array.isArray(args.items) ? args.items : []);
      default: throw new Error(`Unsupported tool: ${toolName}`);
    }
  }
}
