import { describe, expect, it } from 'vitest';
import { MemoryStore } from './store.js';

describe('MemoryStore', () => {
  it('creates a project and session with defaults', () => { const store = new MemoryStore(); const project = store.createProject({ name: 'OpenWork', rootPath: process.cwd() }); const session = store.createSession(project.id, {}); expect(session.title).toBe('New Session'); expect(project.sessionCount).toBe(0); expect(store.projects.get(project.id)?.sessionCount).toBe(1); });
  it('keeps message sequence and supports rerun ancestry', () => { const store = new MemoryStore(); const p = store.createProject({ name: 'x', rootPath: process.cwd() }); const s = store.createSession(p.id, {}); const a = store.addMessage(s.id, 'user', 'a'); const b = store.addMessage(s.id, 'user', 'b', a.id); const fork = store.addMessage(s.id, 'user', 'edited', a.id, b.id); expect(fork.editedFromMessageId).toBe(b.id); expect(fork.seq).toBe(3); });
});
