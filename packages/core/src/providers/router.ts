/**
 * ProviderRouter — 模型 Provider 路由器
 *
 * 职责:
 *  1. 根据 model ID 前缀/格式 路由到对应 Provider (OpenAI / Anthropic / Ollama)
 *  2. 统一 stream / call 接口,屏蔽底层差异
 *  3. 暴露 listModels / health 汇总所有已配置 Provider 的状态
 *
 * 路由规则:
 *  - model 以 `claude-` / `anthropic/` 开头 → Anthropic
 *  - model 以 `gpt-` / `o1-` / `o3-` / `openai/` 开头 → OpenAI
 *  - model 以 `ollama/` 开头,或主 provider 配置为 ollama → Ollama
 *  - 否则按配置的 default provider 路由
 *
 * 对应 06-详细设计文档 v4.2 §3.3 ProviderRouter
 */
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';
import type { ModelProvider, ProviderKind, ModelInfo, ProviderConfig } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { VolcArkProvider } from './volcark-provider.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('ProviderRouter');

export interface ProviderRouterOptions {
  /** 默认 Provider (路由无法识别时使用) */
  defaultProvider: ProviderKind;
  /** 各 Provider 的配置 */
  providers: Record<ProviderKind, ProviderConfig>;
}

export class ProviderRouter implements ModelProvider {
  readonly kind = 'custom' as const;

  private providers: Partial<Record<ProviderKind, ModelProvider>> = {};
  private defaultProvider: ProviderKind;

  constructor(opts: ProviderRouterOptions) {
    this.defaultProvider = opts.defaultProvider;

    // 按需实例化 Provider (跳过未配置 apiKey 的,但 Ollama 总是实例化)
    for (const [kind, config] of Object.entries(opts.providers) as Array<[ProviderKind, ProviderConfig]>) {
      const provider = this.createProvider(kind, config);
      if (provider) {
        this.providers[kind] = provider;
        log.info('provider registered', { kind, ready: provider.isReady() });
      }
    }

    if (!this.providers[this.defaultProvider]) {
      log.warn('default provider not configured, will fall back at call time', {
        default: this.defaultProvider,
      });
    }
  }

  isReady(): boolean {
    return Object.values(this.providers).some((p) => p.isReady());
  }

  /**
   * 根据请求选择合适的 Provider
   * 优先级: 显式 req.provider > model ID 前缀 > default
   */
  private resolveProvider(req: ModelCallRequest): ModelProvider {
    const kind = this.resolveKind(req.model, req.provider as ProviderKind | undefined);
    const provider = this.providers[kind];
    if (!provider) {
      throw Object.assign(
        new Error(`provider '${kind}' not configured (model=${req.model})`),
        { code: -32603 },
      );
    }
    return provider;
  }

  /** 从 model ID 与显式 provider 推断 ProviderKind */
  private resolveKind(model: string, explicit?: ProviderKind): ProviderKind {
    if (explicit && this.providers[explicit]) return explicit;

    const lower = model.toLowerCase();
    if (lower.startsWith('claude-') || lower.startsWith('anthropic/')) {
      return 'anthropic';
    }
    if (lower.startsWith('gpt-') || lower.startsWith('o1-') || lower.startsWith('o3-') || lower.startsWith('openai/')) {
      return 'openai';
    }
    // 火山引擎方舟模型前缀: doubao- / kimi- / glm- / deepseek- / minimax- / ark-
    if (
      lower.startsWith('doubao-') ||
      lower.startsWith('kimi-') ||
      lower.startsWith('glm-') ||
      lower.startsWith('deepseek-') ||
      lower.startsWith('minimax-') ||
      lower.startsWith('ark-') ||
      lower.startsWith('volcengine/')
    ) {
      return 'volcengine';
    }
    if (lower.startsWith('ollama/') || lower.includes(':')) {
      // `model:tag` 格式 (Ollama 模型命名)
      return 'custom';
    }
    return this.defaultProvider;
  }

  async *stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk> {
    const provider = this.resolveProvider(req);
    // 剥离 `provider/` 前缀,只传真实 model ID 给底层 SDK
    const cleanReq: ModelCallRequest = {
      ...req,
      model: stripProviderPrefix(req.model),
    };
    yield* provider.stream(cleanReq);
  }

  async call(req: ModelCallRequest): Promise<ModelCallResult> {
    const provider = this.resolveProvider(req);
    const cleanReq: ModelCallRequest = {
      ...req,
      model: stripProviderPrefix(req.model),
    };
    return provider.call(cleanReq);
  }

  async listModels(): Promise<ModelInfo[]> {
    const all: ModelInfo[] = [];
    for (const provider of Object.values(this.providers)) {
      try {
        const models = await provider.listModels();
        all.push(...models);
      } catch (err) {
        log.warn('failed to list models from provider', {
          kind: provider.kind,
          error: (err as Error).message,
        });
      }
    }
    return all;
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    const entries = Object.entries(this.providers);
    if (entries.length === 0) return { ok: false, error: 'no provider configured' };

    // 任一 Provider healthy 即认为整体 healthy
    let anyOk = false;
    let maxLatency = 0;
    const errors: string[] = [];

    for (const [kind, provider] of entries) {
      const result = await provider.health();
      if (result.ok) {
        anyOk = true;
        maxLatency = Math.max(maxLatency, result.latencyMs ?? 0);
      } else {
        errors.push(`${kind}: ${result.error ?? 'unknown'}`);
      }
    }

    return {
      ok: anyOk,
      latencyMs: maxLatency,
      error: anyOk ? undefined : errors.join('; '),
    };
  }

  /** 获取指定 Provider 实例 (供外部健康检查等) */
  getProvider(kind: ProviderKind): ModelProvider | undefined {
    return this.providers[kind];
  }

  /** 列出所有已配置的 Provider kinds */
  listProviderKinds(): ProviderKind[] {
    return Object.keys(this.providers) as ProviderKind[];
  }

  private createProvider(kind: ProviderKind, config: ProviderConfig): ModelProvider | null {
    switch (kind) {
      case 'openai':
        return new OpenAIProvider(config);
      case 'anthropic':
        return new AnthropicProvider(config);
      case 'ollama':
        return new OllamaProvider(config);
      case 'volcengine':
        return new VolcArkProvider(config);
      case 'azure':
        // Azure OpenAI 复用 OpenAIProvider (设置 baseUrl + apiVersion header)
        // v0.1 简化: 与 OpenAI 一样处理
        return new OpenAIProvider(config);
      case 'custom':
        // 自定义 provider 默认走 OpenAI-compatible
        return new OpenAIProvider(config);
      default:
        log.warn('unknown provider kind, skipping', { kind });
        return null;
    }
  }
}

/** 剥离 model ID 的 provider 前缀 (如 `anthropic/claude-3` → `claude-3`) */
function stripProviderPrefix(model: string): string {
  const slashIdx = model.indexOf('/');
  if (slashIdx === -1) return model;
  // 仅剥离开头的 provider/ 前缀,中间的 / 不剥 (如 OpenAI 的 gpt-4-0613 不会有 /)
  return model.slice(slashIdx + 1);
}

/**
 * 从 AppConfig 构造 ProviderRouter
 * (供 CoreEngine 装配时使用)
 */
export function createProviderRouter(opts: {
  defaultProvider: ProviderKind;
  providersConfig: Record<string, { apiKey: string; baseUrl: string }>;
}): ProviderRouter {
  const providers: Record<ProviderKind, ProviderConfig> = {} as Record<ProviderKind, ProviderConfig>;
  for (const [kind, cfg] of Object.entries(opts.providersConfig)) {
    providers[kind as ProviderKind] = {
      kind: kind as ProviderKind,
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
    };
  }
  return new ProviderRouter({ defaultProvider: opts.defaultProvider, providers });
}
