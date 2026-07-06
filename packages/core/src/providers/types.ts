/**
 * ModelProvider 抽象层类型定义
 *
 * 对应 04-架构设计文档 v4.2 §6 模型适配层
 *      06-详细设计文档 v4.2 §3.2 ModelProvider
 *
 * 所有 LLM Provider (OpenAI / Anthropic / Ollama / Azure / ...) 实现此接口。
 * ProviderRouter 根据模型 ID 前缀路由到对应 Provider。
 */
import type {
  ModelCallRequest,
  ModelCallChunk,
  ModelCallResult,
} from '../agent/types.js';

/** Provider 标识 */
export type ProviderKind = 'openai' | 'anthropic' | 'ollama' | 'azure' | 'volcengine' | 'custom';

/** 模型信息 */
export interface ModelInfo {
  id: string;
  provider: ProviderKind;
  displayName: string;
  contextWindow: number;
  /** 输入价格 (USD / 1M tokens) */
  inputPricePer1M?: number;
  /** 输出价格 (USD / 1M tokens) */
  outputPricePer1M?: number;
  /** 是否支持工具调用 */
  supportsTools?: boolean;
  /** 是否支持视觉 */
  supportsVision?: boolean;
}

/** Provider 配置 */
export interface ProviderConfig {
  kind: ProviderKind;
  apiKey: string;
  baseUrl?: string;
  /** 默认请求参数 */
  defaultParams?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

/** ModelProvider 接口 — 所有 LLM 适配器实现此接口 */
export interface ModelProvider {
  /** Provider 标识 (如 'openai' / 'anthropic' / 'ollama') */
  readonly kind: ProviderKind;

  /** 是否已就绪 (有 API key 等) */
  isReady(): boolean;

  /** 流式调用 (主要入口,返回 token 增量与工具调用) */
  stream(req: ModelCallRequest): AsyncIterable<ModelCallChunk>;

  /** 非流式调用 (内部聚合 stream,返回最终结果) */
  call(req: ModelCallRequest): Promise<ModelCallResult>;

  /** 列出该 Provider 可用的模型 (从 API 或本地枚举) */
  listModels(): Promise<ModelInfo[]>;

  /** 健康检查 */
  health(): Promise<{ ok: boolean; latencyMs?: number; error?: string }>;
}

/** 工具定义 (Provider 通用格式,简化版) */
export interface ProviderToolDef {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>; // JSON Schema
  };
}
