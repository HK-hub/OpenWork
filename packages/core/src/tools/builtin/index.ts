/**
 * 内置工具 — read_file / write_file / shell_exec
 *
 * v0.1 必需的最小工具集,对应 08 文档 §9.1 packages/core/src/tools/builtin/
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { defineTool } from '../registry.js';
import type { ToolRegistry } from '../registry.js';
import type { ToolDef } from '@opencode/api';
import { moduleLogger } from '../../utils/logger.js';

const log = moduleLogger('BuiltinTools');

/** 注册所有内置工具 */
export function registerBuiltinTools(registry: ToolRegistry): void {
  // ── read_file ──
  const readFileDef: ToolDef = {
    name: 'read_file',
    description: '读取文件内容',
    source: 'builtin',
    parametersSchema: {
      type: 'object',
      properties: { path: { type: 'string', description: '文件绝对路径' } },
      required: ['path'],
    },
    riskLevel: 'L0',
    requiresApproval: false,
    enabled: true,
    category: 'file',
  };
  registry.register(readFileDef, async (args) => {
    const path = resolve(args.path as string);
    if (!existsSync(path)) {
      return { callId: '', output: { error: `File not found: ${path}` }, meta: { isError: true } };
    }
    const content = readFileSync(path, 'utf8');
    return { callId: '', output: { path, content }, meta: {} };
  });

  // ── write_file ──
  const writeFileDef: ToolDef = {
    name: 'write_file',
    description: '写入文件 (会创建不存在的目录)',
    source: 'builtin',
    parametersSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件绝对路径' },
        content: { type: 'string', description: '文件内容' },
        createDirs: { type: 'boolean', description: '是否创建目录,默认 true' },
      },
      required: ['path', 'content'],
    },
    riskLevel: 'L1',
    requiresApproval: true,
    enabled: true,
    category: 'file',
  };
  registry.register(writeFileDef, async (args) => {
    const path = resolve(args.path as string);
    const content = args.content as string;
    if (args.createDirs !== false) {
      mkdirSync(dirname(path), { recursive: true });
    }
    writeFileSync(path, content, 'utf8');
    log.info('file written', { path, bytes: content.length });
    return { callId: '', output: { path, bytes: content.length }, meta: {} };
  });

  // ── shell_exec ──
  const shellExecDef: ToolDef = {
    name: 'shell_exec',
    description: '执行 shell 命令 (高风险,需审批)',
    source: 'builtin',
    parametersSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '要执行的命令' },
        cwd: { type: 'string', description: '工作目录' },
        timeout: { type: 'number', description: '超时毫秒,默认 30000' },
      },
      required: ['command'],
    },
    riskLevel: 'L2',
    requiresApproval: true,
    enabled: true,
    category: 'shell',
  };
  registry.register(shellExecDef, async (args, ctx) => {
    return new Promise((resolvePromise) => {
      const command = args.command as string;
      const cwd = args.cwd as string | undefined;
      const timeout = (args.timeout as number | undefined) ?? 30000;
      log.info('shell exec', { command, cwd });
      const proc = spawn(command, { cwd, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d) => (stdout += d.toString()));
      proc.stderr?.on('data', (d) => (stderr += d.toString()));
      const timer = setTimeout(() => proc.kill('SIGTERM'), timeout);
      ctx.abortSignal.addEventListener('abort', () => proc.kill('SIGTERM'));
      proc.on('close', (code) => {
        clearTimeout(timer);
        resolvePromise({
          callId: '',
          output: { code, stdout, stderr },
          meta: { isError: code !== 0 },
        });
      });
      proc.on('error', (err) => {
        clearTimeout(timer);
        resolvePromise({
          callId: '',
          output: { error: err.message, code: -1 },
          meta: { isError: true },
        });
      });
    });
  });

  log.info('builtin tools registered', { count: registry.list().length });
}

// 防止 unused import 警告
void defineTool;
