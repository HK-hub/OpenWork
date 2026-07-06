/**
 * 配置加载器 — 读取 config 文件 + 应用默认值
 *
 * v0.1: 简化版,配置持久化在 SQLite configs 表。
 * Profile / 模型配置 / MCP servers 在 profiles / configs 表中。
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('ConfigLoader');

/** 默认配置 */
export const DEFAULT_CONFIG = {
  /** 后端监听配置 (服务式模式) */
  server: {
    host: '127.0.0.1',
    port: 0, // 0 = 随机端口
    transport: 'embedded' as const, // v0.1 默认嵌入式
  },
  /** 模型默认配置 */
  model: {
    provider: 'volcengine' as const,
    name: 'doubao-seed-2.0-code',
    params: {
      temperature: 0,
      maxTokens: 8192,
    },
    /** API 密钥 (优先从 env 读取,运行时可由用户在设置 UI 覆盖) */
    apiKey: '',
    /** 自定义 API base URL (Ollama 等本地服务用,如 http://localhost:11434/v1) */
    baseUrl: '',
    /** 多 Provider 配置 (v0.1 简化: 仅支持单 provider,后续扩展) */
    providers: {
      openai: { apiKey: '', baseUrl: 'https://api.openai.com/v1' },
      anthropic: { apiKey: '', baseUrl: 'https://api.anthropic.com' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
      volcengine: {
        apiKey: '',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/coding/v3',
      },
    } as Record<string, { apiKey: string; baseUrl: string }>,
  },
  /** Agent Loop 默认配置 */
  agent: {
    maxIterations: 25,
    pauseOnToolApproval: true,
    autoApproveLowRisk: true,
    budgetUsd: 5.0,
  },
  /** 数据库配置 */
  database: {
    path: '', // 运行时填充 (userData 目录)
    walMode: true,
    cacheSize: -64000, // 64MB
  },
  /** UI 偏好 */
  ui: {
    theme: 'auto' as const,
    sidebarCollapsed: false,
    fontSize: 14,
  },
  /** 日志 */
  logging: {
    level: 'info' as const,
    file: true,
  },
  /** MCP 默认配置 */
  mcp: {
    servers: [] as Array<{ name: string; transport: string; command?: string; args?: string[]; url?: string }>,
  },
  /** v0.1 启用的模块 (其他模块 v0.2+) */
  modules: {
    loop: true,
    tool: true,
    mcp: true,
    permission: true,
    memory: false, // v0.2+
    plugin: false, // v0.2+
    hook: false, // v0.2+
    skill: false, // v0.2+
    subagent: false, // v0.3+
    multiagent: false, // v0.3+
  },
} as const;

export type AppConfig = typeof DEFAULT_CONFIG;

/** 深度合并用户配置到默认配置 */
function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== 'object' || base === null || Array.isArray(base)) {
    return (override ?? base) as T;
  }
  if (typeof override !== 'object' || override === null) return base;
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const bVal = (result as Record<string, unknown>)[key];
    const oVal = (override as Record<string, unknown>)[key];
    if (typeof bVal === 'object' && bVal !== null && !Array.isArray(bVal)) {
      result[key] = deepMerge(bVal, oVal);
    } else {
      result[key] = oVal;
    }
  }
  return result as T;
}

/** 用户配置文件路径 (userData/opencode.config.json) */
export function getUserConfigPath(userDataDir?: string): string {
  const base = userDataDir ?? join(homedir(), '.opencode');
  return join(base, 'config.json');
}

/** 加载配置 (用户配置覆盖默认值) */
export function loadConfig(opts: { userDataDir?: string; configPath?: string } = {}): AppConfig {
  const configPath = opts.configPath ?? getUserConfigPath(opts.userDataDir);

  let userConfig: Record<string, unknown> = {};
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, 'utf8');
      userConfig = JSON.parse(raw);
      log.info('config loaded', { path: configPath });
    } else {
      log.info('config file not found, using defaults', { path: configPath });
    }
  } catch (err) {
    log.warn('config load failed, using defaults', { path: configPath, error: (err as Error).message });
  }

  return deepMerge(DEFAULT_CONFIG, userConfig);
}

/** 保存配置到文件 */
export function saveConfig(config: Partial<AppConfig>, opts: { userDataDir?: string } = {}): void {
  const configPath = getUserConfigPath(opts.userDataDir);
  try {
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    log.info('config saved', { path: configPath });
  } catch (err) {
    log.error('config save failed', { path: configPath, error: (err as Error).message });
    throw err;
  }
}

/** 运行时配置上下文 (供后端模块读取) */
export interface ConfigContext {
  readonly config: AppConfig;
  get<T>(path: string): T | undefined;
  set(path: string, value: unknown): void;
}

/** 从配置对象按 path 取值 (如 'model.name') */
export function getConfigValue(config: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, config);
}

/** 在配置对象上按 path 设值 */
export function setConfigValue(config: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let target = config;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!(key in target) || typeof target[key] !== 'object') {
      target[key] = {};
    }
    target = target[key] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]!] = value;
}
