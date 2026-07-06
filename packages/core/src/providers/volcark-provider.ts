/**
 * VolcArkProvider — 火山引擎方舟 (Volcano Engine Ark) 适配器
 *
 * 完全兼容 OpenAI 协议,复用 OpenAIProvider 实现。
 * 主要差异:
 *  - baseUrl 默认 `https://ark.cn-beijing.volces.com/api/v3` (数据面)
 *    或 `https://ark.cn-beijing.volces.com/api/coding/v3` (Coding Plan)
 *  - 已知模型列表: 豆包 / Kimi / GLM / DeepSeek / MiniMax 等
 *  - apiKey 格式: `ark-xxxxx`
 *
 * 对应接入文档: https://www.volcengine.com/docs/82379/1928261
 *      兼容 OpenAI SDK: https://www.volcengine.com/docs/82379/1330626
 */
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';
import type { ModelProvider, ProviderConfig, ModelInfo } from './types.js';
import { OpenAIProvider } from './openai-provider.js';
import { moduleLogger } from '../utils/logger.js';

const log = moduleLogger('VolcArkProvider');

/**
 * 火山引擎方舟已知模型列表
 *
 * 来源: https://www.volcengine.com/docs/82379/2188959 (Coding Plan)
 * 价格为 Coding Plan 订阅价格,按 token 计费 (USD/1M tokens,估算)
 */
const VOLC_ARK_MODELS: ModelInfo[] = [
  {
    id: 'doubao-seed-2.0-code',
    provider: 'volcengine',
    displayName: 'Doubao Seed 2.0 Code',
    contextWindow: 256_000,
    inputPricePer1M: 0.7,
    outputPricePer1M: 2.8,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'doubao-seed-2.0-pro',
    provider: 'volcengine',
    displayName: 'Doubao Seed 2.0 Pro',
    contextWindow: 256_000,
    inputPricePer1M: 1.4,
    outputPricePer1M: 5.6,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'doubao-seed-2.0-lite',
    provider: 'volcengine',
    displayName: 'Doubao Seed 2.0 Lite',
    contextWindow: 256_000,
    inputPricePer1M: 0.15,
    outputPricePer1M: 0.6,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'doubao-seed-code',
    provider: 'volcengine',
    displayName: 'Doubao Seed Code',
    contextWindow: 128_000,
    inputPricePer1M: 0.7,
    outputPricePer1M: 2.8,
    supportsTools: true,
    supportsVision: false,
  },
  {
    id: 'kimi-k2.7-code',
    provider: 'volcengine',
    displayName: 'Kimi K2.7 Code',
    contextWindow: 256_000,
    inputPricePer1M: 1.2,
    outputPricePer1M: 4.8,
    supportsTools: true,
    supportsVision: false,
  },
  {
    id: 'kimi-k2.6',
    provider: 'volcengine',
    displayName: 'Kimi K2.6',
    contextWindow: 256_000,
    inputPricePer1M: 1.2,
    outputPricePer1M: 4.8,
    supportsTools: true,
    supportsVision: false,
  },
  {
    id: 'glm-5.2',
    provider: 'volcengine',
    displayName: 'GLM 5.2',
    contextWindow: 128_000,
    inputPricePer1M: 0.5,
    outputPricePer1M: 1.5,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'deepseek-v4-pro',
    provider: 'volcengine',
    displayName: 'DeepSeek V4 Pro',
    contextWindow: 128_000,
    inputPricePer1M: 1.0,
    outputPricePer1M: 4.0,
    supportsTools: true,
    supportsVision: false,
  },
  {
    id: 'deepseek-v4-flash',
    provider: 'volcengine',
    displayName: 'DeepSeek V4 Flash',
    contextWindow: 128_000,
    inputPricePer1M: 0.2,
    outputPricePer1M: 0.8,
    supportsTools: true,
    supportsVision: false,
  },
  {
    id: 'minimax-m3',
    provider: 'volcengine',
    displayName: 'MiniMax M3',
    contextWindow: 1_000_000,
    inputPricePer1M: 0.7,
    outputPricePer1M: 2.8,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'ark-code-latest',
    provider: 'volcengine',
    displayName: 'Ark Code Latest (Auto)',
    contextWindow: 256_000,
    inputPricePer1M: 1.0,
    outputPricePer1M: 4.0,
    supportsTools: true,
    supportsVision: true,
  },
];

export class VolcArkProvider implements ModelProvider {
  readonly kind = 'volcengine' as const;
  private inner: OpenAIProvider;

  constructor(config: ProviderConfig) {
    // 默认使用 Coding Plan 的 base URL (订阅制,token 单价更低)
    const baseUrl = config.baseUrl || 'https://ark.cn-beijing.volces.com/api/coding/v3';
    const effectiveConfig: ProviderConfig = {
      ...config,
      kind: 'volcengine',
      baseUrl,
      apiKey: config.apiKey || process.env['ARK_API_KEY'] || '',
    };
    this.inner = new OpenAIProvider(effectiveConfig);
    log.info('VolcArkProvider initialized', {
      baseUrl,
      hasApiKey: !!effectiveConfig.apiKey,
      apiKeyPrefix: effectiveConfig.apiKey ? effectiveConfig.apiKey.slice(0, 8) + '...' : '(none)',
    });
  }

  isReady(): boolean {
    return this.inner.isReady();
  }

  async *stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk> {
    yield* this.inner.stream(req);
  }

  async call(req: ModelCallRequest): Promise<ModelCallResult> {
    return this.inner.call(req);
  }

  async listModels(): Promise<ModelInfo[]> {
    // 火山引擎 /api/v3/models 接口可能不返回 Coding Plan 的模型,
    // 直接返回已知模型列表
    return VOLC_ARK_MODELS;
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    // 复用 OpenAIProvider 的健康检查 (调用 /models 端点)
    // 注: Coding Plan 的 /models 可能返回 404,因此改用最小 chat 请求
    if (!this.inner.isReady()) return { ok: false, error: 'API key not configured' };
    const start = Date.now();
    try {
      // 用最小请求 ping API
      const result = await this.inner.call({
        prompt: {
          system: '',
          messages: [{ role: 'user', content: 'ping' }],
        },
        model: VOLC_ARK_MODELS[0]!.id,
        provider: 'volcengine',
        params: { maxTokens: 1 },
        stream: false,
      });
      return { ok: true, latencyMs: Date.now() - start, error: result.content ? undefined : 'empty response' };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }
}
