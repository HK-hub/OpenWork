/**
 * AnthropicProvider — Anthropic Claude Message API 适配器
 *
 * 兼容:
 *  - Claude 系列模型 (claude-3-5-sonnet / claude-3-5-haiku / claude-opus-4 等)
 *  - Claude 兼容代理 (自定义 baseUrl)
 *
 * 使用 `@anthropic-ai/sdk`,原生支持流式 MessageStream 与 tool_use 块。
 *
 * 对应 06-详细设计文档 v4.2 §3.2.2 Anthropic Provider
 */
import Anthropic from '@anthropic-ai/sdk';
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';
import type { ModelProvider, ProviderConfig, ModelInfo, ProviderToolDef } from './types.js';
import { moduleLogger } from '../utils/logger.js';
import { genRawId } from '../utils/id-generator.js';

const log = moduleLogger('AnthropicProvider');

const KNOWN_MODELS: ModelInfo[] = [
  {
    id: 'claude-opus-4',
    provider: 'anthropic',
    displayName: 'Claude Opus 4',
    contextWindow: 200_000,
    inputPricePer1M: 15,
    outputPricePer1M: 75,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'claude-sonnet-4',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    contextWindow: 200_000,
    inputPricePer1M: 3,
    outputPricePer1M: 15,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    inputPricePer1M: 3,
    outputPricePer1M: 15,
    supportsTools: true,
    supportsVision: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    provider: 'anthropic',
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    inputPricePer1M: 0.8,
    outputPricePer1M: 4,
    supportsTools: true,
    supportsVision: true,
  },
];

export class AnthropicProvider implements ModelProvider {
  readonly kind = 'anthropic' as const;
  private client: Anthropic | null = null;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.maybeInitClient();
  }

  private maybeInitClient(): void {
    const apiKey = this.config.apiKey || process.env['ANTHROPIC_API_KEY'] || '';
    if (!apiKey) {
      log.warn('Anthropic API key not configured');
      return;
    }
    this.client = new Anthropic({
      apiKey,
      baseURL: this.config.baseUrl || undefined,
    });
    log.info('Anthropic client initialized', { baseUrl: this.config.baseUrl ?? 'default' });
  }

  isReady(): boolean {
    return this.client !== null;
  }

  async *stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk> {
    if (!this.client) {
      throw Object.assign(new Error('Anthropic provider not ready (missing API key)'), { code: -32603 });
    }

    const { system, messages } = this.toAnthropicMessages(req);
    const tools = this.toAnthropicTools(req.tools);

    log.info('calling Anthropic', {
      model: req.model,
      messageCount: messages.length,
      hasTools: tools.length > 0,
      stream: req.stream,
    });

    const response = await this.client.messages.create({
      model: req.model,
      system: system || undefined,
      messages,
      tools: tools.length > 0 ? tools : undefined,
      temperature: req.params?.temperature ?? this.config.defaultParams?.temperature,
      max_tokens: req.params?.maxTokens ?? this.config.defaultParams?.maxTokens ?? 8192,
      top_p: req.params?.topP ?? this.config.defaultParams?.topP,
      stream: true,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    // 工具调用累积器 (input_json_delta 分多个事件返回,需合并)
    const toolBuffers = new Map<number, { id: string; name: string; rawArgs: string }>();

    for await (const event of response) {
      switch (event.type) {
        case 'message_start': {
          inputTokens = event.message.usage?.input_tokens ?? 0;
          break;
        }
        case 'content_block_start': {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            toolBuffers.set(event.index, {
              id: block.id,
              name: block.name,
              rawArgs: '',
            });
          }
          break;
        }
        case 'content_block_delta': {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield { delta: delta.text };
          } else if (delta.type === 'input_json_delta') {
            const buf = toolBuffers.get(event.index);
            if (buf) {
              buf.rawArgs += delta.partial_json;
            }
          }
          break;
        }
        case 'content_block_stop': {
          const buf = toolBuffers.get(event.index);
          if (buf) {
            yield {
              toolCall: {
                id: buf.id,
                name: buf.name,
                args: safeParseArgs(buf.rawArgs),
              },
            };
            toolBuffers.delete(event.index);
          }
          break;
        }
        case 'message_delta': {
          const usage = event.usage;
          if (usage?.output_tokens) {
            outputTokens = usage.output_tokens;
          }
          if (event.delta?.stop_reason) {
            // 映射 stop_reason 到通用 finishReason
            yield { finishReason: mapStopReason(event.delta.stop_reason) };
          }
          break;
        }
        case 'message_stop': {
          // 流结束,不需要额外事件
          break;
        }
        default:
          // 忽略 ping 等其他事件
          break;
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
    // Anthropic API 不提供 /v1/models 列表,返回已知模型
    return KNOWN_MODELS;
  }

  async health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
    if (!this.client) return { ok: false, error: 'API key not configured' };
    const start = Date.now();
    try {
      // 用 count tokens 端点 ping API (不消耗 LLM 推理配额)
      await this.client.messages.countTokens({
        model: KNOWN_MODELS[0]!.id,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return { ok: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: (err as Error).message };
    }
  }

  // ════════════════════════════════════════
  // 内部辅助
  // ════════════════════════════════════════

  private toAnthropicMessages(
    req: ModelCallRequest,
  ): { system: string; messages: Anthropic.MessageParam[] } {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of req.prompt.messages) {
      if (msg.role === 'tool') {
        // Anthropic: tool_result 作为 user 角色的 content block,需关联 tool_use_id
        messages.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolCallId ?? 'unknown',
            content: msg.content,
          }],
        });
      } else if (msg.role === 'assistant') {
        // Anthropic: assistant 消息若有 toolCalls,需用 content blocks 数组
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const contentBlocks: Anthropic.ContentBlockParam[] = [];
          if (msg.content) {
            contentBlocks.push({ type: 'text', text: msg.content });
          }
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: (tc.args as Record<string, unknown>) ?? {},
            });
          }
          messages.push({ role: 'assistant', content: contentBlocks });
        } else {
          messages.push({ role: 'assistant', content: msg.content });
        }
      } else if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
      }
      // system 消息单独提取到顶层 system 参数
    }

    return { system: req.prompt.system, messages };
  }

  private toAnthropicTools(tools?: unknown[]): Anthropic.Tool[] {
    if (!tools || tools.length === 0) return [];
    return tools.map((t) => {
      const def = t as ProviderToolDef;
      return {
        name: def.function.name,
        description: def.function.description ?? '',
        input_schema: (def.function.parameters as Anthropic.Tool.InputSchema) ?? {
          type: 'object',
          properties: {},
        },
      };
    });
  }

  /** 根据模型 ID 估算 USD 成本 */
  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const info = KNOWN_MODELS.find((m) => m.id === model);
    if (!info?.inputPricePer1M || !info?.outputPricePer1M) return 0;
    return (
      (inputTokens / 1_000_000) * info.inputPricePer1M +
      (outputTokens / 1_000_000) * info.outputPricePer1M
    );
  }
}

function safeParseArgs(s: string): unknown {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return { _raw: s };
  }
}

function mapStopReason(stopReason: string): string {
  switch (stopReason) {
    case 'end_turn':
      return 'stop';
    case 'tool_use':
      return 'tool_calls';
    case 'max_tokens':
      return 'length';
    case 'stop_sequence':
      return 'stop';
    default:
      return stopReason;
  }
}
