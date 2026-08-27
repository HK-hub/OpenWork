import { describe, expect, it, vi } from 'vitest';
import { ChatGateway } from './chat.gateway.js';
import { MemoryStore } from './store.js';
import { ToolExecutor } from './tool-executor.js';
import { WorkspaceService } from './workspace.js';

describe('ChatGateway', () => {
  it('rejects malformed tool JSON without persisting a user message', async () => {
    const store = new MemoryStore();
    const workspace = new WorkspaceService();
    const project = store.createProject({ name: 'test', rootPath: workspace.registerRoot(process.cwd()) });
    const session = store.createSession(project.id, {});
    const gateway = new ChatGateway(store, new ToolExecutor(store, workspace));
    gateway.server = { to: vi.fn(() => ({ emit: vi.fn() })) } as never;

    const result = await gateway.send({ requestId: 'request-1', sessionId: session.id, content: '/tool read_file {bad json}' });

    expect(result.ok).toBe(false);
    expect(store.listMessages(session.id)).toHaveLength(0);
  });

  it('emits an empty assistant message before stream deltas', async () => {
    const store = new MemoryStore();
    const workspace = new WorkspaceService();
    const project = store.createProject({ name: 'test', rootPath: workspace.registerRoot(process.cwd()) });
    const session = store.createSession(project.id, {});
    const emitted: string[] = [];
    const gateway = new ChatGateway(store, new ToolExecutor(store, workspace));
    gateway.server = { to: vi.fn(() => ({ emit: (type: string) => emitted.push(type) })) } as never;

    await gateway.send({ requestId: 'request-1', sessionId: session.id, content: 'hello' });

    const firstDelta = emitted.indexOf('stream.delta');
    const assistantAppend = emitted.findIndex((type, index) => type === 'message.appended' && index > 0);
    expect(assistantAppend).toBeGreaterThan(0);
    expect(assistantAppend).toBeLessThan(firstDelta);
  });
});
