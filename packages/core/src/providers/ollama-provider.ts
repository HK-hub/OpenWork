/**
 * OllamaProvider — 本地 Ollama 适配器
 *
 * Ollama 暴露 OpenAI-compatible API (`/v1/chat/completions`),复用 OpenAIProvider 实现。
 * 主要差异:
 *  - baseUrl 默认 `http://localhost:11434/v1`
 *  - apiKey 可空 (Ollama 不校验,但 OpenAI SDK 要求非空,使用占位符)
 *  - 已知模型列表从 `/v1/models` 拉取 (lazy)
 *
 * 对应 06-详细设计文档 v4.2 §3.2.3 Ollama Provider
 */
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';
import type { ModelProvider, ProviderConfig, ModelInfo } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('OllamaProvider');

/** Ollama 常用本地模型默认上下文窗口 */
const FALLBACK_MODELS: ModelInfo[] = [
  { id: 'llama3.1:8b', provider: 'custom', displayName: 'Llama 3.1 8B', contextWindow: 128_000, supportsTools: true },
  { id: 'llama3.1:70b', provider: 'custom', displayName: 'Llama 3.1 70B', contextWindow: 128_000, supportsTools: true },
  { id: 'qwen2.5:7b', provider: 'custom', displayName: 'Qwen 2.5 7B', contextWindow: 32_000, supportsTools: true },
  { id: 'deepseek-r1:8b', provider: 'custom', displayName: 'DeepSeek R1 8B', contextWindow: 64_000, supportsTools: false },
  { id: 'mistral:7b', provider: 'custom', displayName: 'Mistral 7B', contextWindow: 32_000, supportsTools: true },
];

export class OllamaProvider implements ModelProvider {
  readonly kind = 'custom' as const;
  private inner: OpenAIProvider;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = (config.baseUrl || 'http://localhost:11434/v1').replace(/\/$/, '');
    // Ollama 不需要真实 API key,但 OpenAI SDK 要求非空字段
    const effectiveConfig: ProviderConfig = {
      ...config,
      kind: 'custom',
      apiKey: config.apiKey || 'ollama-no-key',
      baseUrl: this.baseUrl,
    };
    this.inner = new OpenAIProvider(effectiveConfig);
    log.info('OllamaProvider initialized', { baseUrl: this.baseUrl });
  }

  isReady(): boolean {
    // Ollama 始终认为是就绪的 (本地服务,无密钥要求)
    return true;
  }

  async *stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk> {
    yield* this.inner.stream(req);
  }

  async call(req: ModelCallRequest): Promise<ModelCallResult> {
    return this.inner.call(req);
  }

  async listModels(): Promise<ModelInfo[]> {
    // 尝试从 /v1/models 拉取本地模型列表
    try {
      const resp = await fetch(`${this.baseUrl}/models`, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) {
        log.warn('failed to list models, using fallback', { status: resp.status });
        return FALLBACK_MODELS;
      }
      const data = (await resp.json()) as { data?: Array<{ id: string }> };
      const models: ModelInfo[] = (data.data ?? []).map((m) => ({
        id: m.id,
        provider: 'custom' as const,
        displayName: m.id,
        contextWindow: 8192, // Ollama 不返回上下文窗口,用保守值
        supportsTools: true,
      }));
      return models.length > 0 ? models : FALLBACK_MODELS;
    } catch (err) {
      log.warn('failed to fetch Ollama models, using fallback', { error: (err as Error).message });
      return FALLBACK_MODELS;
    }
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const start = Date.now();
    try {
      const resp = await fetch(`${this.baseUrl}/models`, { signal: AbortSignal.timeout(3000) });
      return { ok: resp.ok, latencyMs: Date.now() - start, error: resp.ok ? undefined : `HTTP ${resp.status}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
