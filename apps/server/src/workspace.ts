import { Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { TOOL_METADATA, TOOL_NAMES, type PermissionLevel, type ToolName } from '@openwork/contracts';

export class PathOutsideWhitelistError extends Error { readonly code = 'PATH_OUTSIDE_WHITELIST'; }

@Injectable()
export class WorkspaceService {
  private readonly roots = new Set<string>();
  registerRoot(rootPath: string) { const resolved = path.resolve(rootPath); this.roots.add(resolved); return resolved; }
  assertAllowed(target: string) { const resolved = path.resolve(target); const allowed = [...this.roots].some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`)); if (!allowed) throw new PathOutsideWhitelistError(`Path is outside registered workspaces: ${target}`); return resolved; }
  permission(toolName: ToolName): PermissionLevel { return TOOL_METADATA[toolName].permissionLevel; }
  async readFile(target: string) { return fs.readFile(this.assertAllowed(target), 'utf8'); }
  async writeFile(target: string, content: string) { const resolved = this.assertAllowed(target); await fs.mkdir(path.dirname(resolved), { recursive: true }); await fs.writeFile(resolved, content, 'utf8'); return { path: resolved, bytes: Buffer.byteLength(content) }; }
  async deleteFile(target: string) { await fs.rm(this.assertAllowed(target), { recursive: true, force: false }); }
  async moveFile(from: string, to: string) { const source = this.assertAllowed(from); const destination = this.assertAllowed(to); await fs.rename(source, destination); }
  async glob(pattern: string, root: string) { const resolvedRoot = this.assertAllowed(root); const entries = await fs.readdir(resolvedRoot, { recursive: true }); return entries.filter((entry) => typeof entry === 'string' && entry.includes(pattern.replaceAll('*', ''))).map((entry) => path.join(resolvedRoot, entry)); }
  toolNames() { return Object.values(TOOL_NAMES); }
}
