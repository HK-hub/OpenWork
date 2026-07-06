/**
 * OpenAIProvider — OpenAI (与 OpenAI-compatible API) 适配器
 *
 * 兼容:
 *  - OpenAI 官方 API (gpt-4o, gpt-5 等)
 *  - Azure OpenAI (需设置 baseUrl)
 *  - 本地 Ollama / vLLM / LM Studio (OpenAI-compatible endpoint)
 *
 * 使用 `openai` npm SDK (内置流式解析 + 重试 + 错误处理)。
 *
 * 对应 06-详细设计文档 v4.2 §3.2.1 OpenAI Provider
 */
import OpenAI from 'openai';
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';
import type { ModelProvider, ProviderConfig, ModelInfo, ProviderToolDef } from './types.js';
import { moduleLogger } from '../utils/logger.js';
import { genRawId } from '../utils/id-generator.js';

const log = moduleLogger('OpenAIProvider');

const KNOWN_MODELS: ModelInfo[] = [
  { id: 'gpt-5', provider: 'openai', displayName: 'GPT-5', contextWindow: 128_000, inputPricePer1M: 5, outputPricePer1M: 15, supportsTools: true, supportsVision: true },
  { id: 'gpt-5-mini', provider: 'openai', displayName: 'GPT-5 Mini', contextWindow: 128_000, inputPricePer1M: 0.15, outputPricePer1M: 0.6, supportsTools: true, supportsVision: true },
  { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', contextWindow: 128_000, inputPricePer1M: 2.5, outputPricePer1M: 10, supportsTools: true, supportsVision: true },
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', contextWindow: 128_000, inputPricePer1M: 0.15, outputPricePer1M: 0.6, supportsTools: true, supportsVision: true },
];

export class OpenAIProvider implements ModelProvider {
  readonly kind = 'openai' as const;
  private client: OpenAI | null = null;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.maybeInitClient();
  }

  private maybeInitClient(): void {
    const apiKey = this.config.apiKey || process.env['OPENAI_API_KEY'] || '';
    if (!apiKey) {
      log.warn('OpenAI API key not configured');
      return;
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: this.config.baseUrl || undefined,
    });
    log.info('OpenAI client initialized', { baseUrl: this.config.baseUrl ?? 'default' });
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async *stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk> {
    if (!this.client) {
      throw Object.assign(new Error('OpenAI provider not ready (missing API key)'), { code: -32603 });
    }

    const messages = this.toOpenAIMessages(req);
    const tools = this.toOpenAITools(req.tools);

    log.info('calling OpenAI', {
      model: req.model,
      messageCount: messages.length,
      hasTools: tools.length > 0,
      stream: req.stream,
    });

    const completion = await this.client.chat.completions.create({
      model: req.model,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: req.params?.temperature ?? this.config.defaultParams?.temperature,
      max_tokens: req.params?.maxTokens ?? this.config.defaultParams?.maxTokens,
      top_p: req.params?.topP ?? this.config.defaultParams?.topP,
      stream: true,
      stream_options: { include_usage: true },
    });

    let inputTokens = 0;
    let outputTokens = 0;

    // 工具调用累积器 (OpenAI 分多个 chunk 返回 tool_calls,需按 index 累积)
    // 第一个 chunk 包含 id + name + 空 arguments,后续 chunk 只包含 arguments 增量
    const toolBuffers = new Map<number, { id: string; name: string; rawArgs: string }>();

    for await (const chunk of completion) {
      // 处理 usage (最后一个 chunk)
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      // 文本增量
      if (delta.content) {
        yield { delta: delta.content };
      }

      // 工具调用增量 — 累积,不立即 yield
      // OpenAI 协议: delta.tool_calls[].index 标识是第几个工具调用
      //   首个 chunk: { index: 0, id: "call_xxx", type: "function", function: { name: "read_file", arguments: "" } }
      //   后续 chunk: { index: 0, function: { arguments: "{\"path" } }
      //   再后续:     { index: 0, function: { arguments: "\":\"...\"}" } }
      if (delta.tool_calls && delta.tool_calls.length > 0) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          let buf = toolBuffers.get(idx);
          if (!buf) {
            buf = {
              id: tc.id ?? genRawId(8),
              name: tc.function?.name ?? '',
              rawArgs: '',
            };
            toolBuffers.set(idx, buf);
          }
          // 首个 chunk 带 id 和 name
          if (tc.id) buf.id = tc.id;
          if (tc.function?.name) buf.name = tc.function.name;
          // 后续 chunk 带 arguments 增量
          if (tc.function?.arguments) {
            buf.rawArgs += tc.function.arguments;
          }
        }
      }

      // 完成原因
      const finishReason = chunk.choices?.[0]?.finish_reason;
      if (finishReason) {
        // 在 finish_reason 到达时,把累积的工具调用一次性 yield
        // (此时所有 arguments 增量已收齐)
        for (const buf of toolBuffers.values()) {
          yield {
            toolCall: {
              id: buf.id,
              name: buf.name,
              args: safeParseArgs(buf.rawArgs),
            },
          };
        }
        toolBuffers.clear();
        yield { finishReason };
      }
    }

    // 若流结束但未收到 finish_reason (异常情况),也把累积的工具调用 yield 出去
    if (toolBuffers.size > 0) {
      for (const buf of toolBuffers.values()) {
        yield {
          toolCall: {
            id: buf.id,
            name: buf.name,
            args: safeParseArgs(buf.rawArgs),
          },
        };
      }
    }

    // 流结束后补一个 usage chunk (供 LoopEngine 累计成本)
    if (inputTokens > 0 || outputTokens > 0) {
      yield { usage: { input: inputTokens, output: outputTokens } };
    }
  }

  async call(req: ModelCallRequest): Promise<ModelCallResult> {
    let content = '';
    const toolCalls: Array<{ id: string; name: string; args: unknown }> = [];
    let finishReason = 'stop';
    let usage = { input: 0, output: 0 };
    let costUsd = 0;

    for await (const chunk of this.stream(req)) {
      if (chunk.delta) content += chunk.delta;
      if (chunk.toolCall) toolCalls.push(chunk.toolCall);
      if (chunk.finishReason) finishReason = chunk.finishReason;
      if (chunk.usage) usage = chunk.usage;
    }

    costUsd = this.estimateCost(req.model, usage.input, usage.output);

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage,
      costUsd,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    // v0.1: 返回已知模型列表;Phase 2+ 支持从 /v1/models 动态拉取
    return KNOWN_MODELS;
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.client) return { ok: false, error: 'API key not configured' };
    const start = Date.now();
    try {
      await this.client.models.list();
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  // ════════════════════════════════════════
  // 内部辅助
  // ════════════════════════════════════════

  private toOpenAIMessages(req: ModelCallRequest): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (req.prompt.system) {
      result.push({ role: 'system', content: req.prompt.system });
    }
    for (const msg of req.prompt.messages) {
      if (msg.role === 'user') {
        result.push({ role: 'user', content: msg.content });
      } else if (msg.role === 'system') {
        result.push({ role: 'system', content: msg.content });
      } else if (msg.role === 'assistant') {
        // assistant 消息: 若有 toolCalls,需用 OpenAI 的 tool_calls 字段格式
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          result.push({
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}),
              },
            })),
          });
        } else {
          result.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'tool') {
        // 工具结果消息: OpenAI 要求 role='tool' + tool_call_id + content
        result.push({
          role: 'tool',
          content: msg.content,
          tool_call_id: msg.toolCallId ?? 'unknown',
        });
      }
    }
    return result;
  }

  private toOpenAITools(tools?: unknown[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => {
      const def = t as ProviderToolDef;
      return {
        type: 'function' as const,
        function: {
          name: def.function.name,
          description: def.function.description ?? '',
          parameters: def.function.parameters ?? { type: 'object', properties: {} },
        },
      };
    });
  }

  /** 根据模型 ID 估算 USD 成本 */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const info = KNOWN_MODELS.find((m) => m.id === model);
    if (!info?.inputPricePer1M || !info?.outputPricePer1M) return 0;
    return (inputTokens / 1_000_000) * info.inputPricePer1M + (outputTokens / 1_000_000) * info.outputPricePer1M;
  }
}

function safeParseArgs(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}
