/**
 * Config Store — 配置状态 (Zustand)
 *
 * 管理:
 *  - 当前模型 (provider / model / contextWindow)
 *  - 权限模式 (approve / auto / ask / trust)
 *  - 模型列表 (供 ContextStatusBar / InputEditor 选择)
 *  - 工作目录路径
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.8.2 数据流 — config-store
 */
import { create } from 'zustand';

export type PermissionMode = 'approve' | 'auto' | 'ask' | 'trust';

export interface ModelOption {
  id: string;
  provider: string;
  displayName: string;
  contextWindow: number;
}

interface ConfigState {
  currentModelId: string;
  models: ModelOption[];
  permissionMode: PermissionMode;
  workingDirectory: string;
  projectTitle: string;

  setCurrentModel: (id: string) => void;
  setPermissionMode: (mode: PermissionMode) => void;
  setWorkingDirectory: (dir: string) => void;
  setProjectTitle: (title: string) => void;
}

/**
 * v0.1 默认模型列表 (后续从后端 config.get / model.list 动态加载)
 *
 * 默认使用火山引擎方舟 (Volcano Engine Ark) Coding Plan 模型,
 * 同时保留 OpenAI / Anthropic / Ollama 选项 (需配置对应 API key)。
 */
const DEFAULT_MODELS: ModelOption[] = [
  // 火山引擎方舟 (默认 Provider, Coding Plan)
  { id: 'doubao-seed-2.0-code', provider: 'volcengine', displayName: 'Doubao Seed 2.0 Code', contextWindow: 256_000 },
  { id: 'doubao-seed-2.0-pro', provider: 'volcengine', displayName: 'Doubao Seed 2.0 Pro', contextWindow: 256_000 },
  { id: 'doubao-seed-2.0-lite', provider: 'volcengine', displayName: 'Doubao Seed 2.0 Lite', contextWindow: 256_000 },
  { id: 'kimi-k2.7-code', provider: 'volcengine', displayName: 'Kimi K2.7 Code', contextWindow: 256_000 },
  { id: 'glm-5.2', provider: 'volcengine', displayName: 'GLM 5.2', contextWindow: 128_000 },
  { id: 'deepseek-v4-pro', provider: 'volcengine', displayName: 'DeepSeek V4 Pro', contextWindow: 128_000 },
  { id: 'deepseek-v4-flash', provider: 'volcengine', displayName: 'DeepSeek V4 Flash', contextWindow: 128_000 },
  { id: 'minimax-m3', provider: 'volcengine', displayName: 'MiniMax M3', contextWindow: 1_000_000 },
  { id: 'ark-code-latest', provider: 'volcengine', displayName: 'Ark Code Latest (Auto)', contextWindow: 256_000 },
  // 其他 Provider (需自行配置 API key)
  { id: 'claude-sonnet-4', provider: 'anthropic', displayName: 'Claude Sonnet 4', contextWindow: 200_000 },
  { id: 'gpt-5', provider: 'openai', displayName: 'GPT-5', contextWindow: 128_000 },
  { id: 'qwen3-coder', provider: 'ollama', displayName: 'Qwen3 Coder (Local)', contextWindow: 32_000 },
];

export const useConfigStore = create<ConfigState>((set) => ({
  currentModelId: 'doubao-seed-2.0-code',
  models: DEFAULT_MODELS,
  permissionMode: 'approve',
  workingDirectory: 'D:\\learn\\project\\openwork',
  projectTitle: 'OpenCoding Agent',

  setCurrentModel: (id) => set({ currentModelId: id }),
  setPermissionMode: (mode) => set({ permissionMode: mode }),
  setWorkingDirectory: (dir) => set({ workingDirectory: dir }),
  setProjectTitle: (title) => set({ projectTitle: title }),
}));
