import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PathOutsideWhitelistError, WorkspaceService } from './workspace.js';

describe('WorkspaceService', () => {
  it('allows reads inside a registered root', async () => { const root = await mkdtemp(path.join(os.tmpdir(), 'openwork-')); await writeFile(path.join(root, 'a.txt'), 'ok'); const service = new WorkspaceService(); service.registerRoot(root); await expect(service.readFile(path.join(root, 'a.txt'))).resolves.toBe('ok'); });
  it('rejects traversal outside a registered root', async () => { const root = await mkdtemp(path.join(os.tmpdir(), 'openwork-')); const service = new WorkspaceService(); service.registerRoot(root); await expect(service.readFile(path.join(root, '..', 'secret.txt'))).rejects.toBeInstanceOf(PathOutsideWhitelistError); });
});
