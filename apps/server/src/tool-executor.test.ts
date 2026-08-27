import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from './store.js';
import { WorkspaceService } from './workspace.js';
import { ToolExecutor } from './tool-executor.js';

describe('ToolExecutor', () => {
  it('executes read_file inside a registered workspace and audits the call', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openwork-tool-'));
    const file = path.join(root, 'notes.md');
    const workspace = new WorkspaceService();
    workspace.registerRoot(root);
    await workspace.writeFile(file, 'hello from workspace');
    const store = new MemoryStore();
    const project = store.createProject({ name: 'test', rootPath: root });
    const session = store.createSession(project.id, {});
    const executor = new ToolExecutor(store, workspace);

    const result = await executor.execute(session.id, 'read_file', { path: file });

    expect(result.status).toBe('succeeded');
    expect(result.output).toBe('hello from workspace');
    expect(store.toolCalls.size).toBe(1);
    expect([...store.toolCalls.values()][0]?.status).toBe('succeeded');
  });

  it('resolves relative tool paths from the session project root', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openwork-tool-'));
    const workspace = new WorkspaceService();
    workspace.registerRoot(root);
    await workspace.writeFile(path.join(root, 'README.md'), 'workspace readme');
    const store = new MemoryStore();
    const project = store.createProject({ name: 'test', rootPath: root });
    const session = store.createSession(project.id, {});
    const executor = new ToolExecutor(store, workspace);

    const result = await executor.execute(session.id, 'read_file', { path: 'README.md' });

    expect(result.status).toBe('succeeded');
    expect(result.output).toBe('workspace readme');
  });

  it('requires approval before destructive tools are executed', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'openwork-tool-'));
    const file = path.join(root, 'delete-me.txt');
    const workspace = new WorkspaceService();
    workspace.registerRoot(root);
    await workspace.writeFile(file, 'keep me');
    const store = new MemoryStore();
    const project = store.createProject({ name: 'test', rootPath: root });
    const session = store.createSession(project.id, {});
    const executor = new ToolExecutor(store, workspace);

    const result = await executor.execute(session.id, 'delete_file', { path: file });

    expect(result.status).toBe('pending_approval');
    await expect(readFile(file, 'utf8')).resolves.toBe('keep me');
  });
});
