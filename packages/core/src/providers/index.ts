/**
 * ModelProvider 抽象层入口
 *
 * 对外暴露:
 *  - ModelProvider 接口与类型
 *  - ProviderRouter 路由器
 *  - 各 Provider 实现 (OpenAI / Anthropic / Ollama)
 *
 * 对应 04-架构设计文档 v4.2 §6 模型适配层
 *      06-详细设计文档 v4.2 §3.2-3.3 ModelProvider
 */
export type {
  ProviderKind,
  ModelInfo,
  ProviderConfig,
  ModelProvider,
  ProviderToolDef,
} from './types.js';

export { OpenAIProvider } from './openai-provider.js';
export { AnthropicProvider } from './anthropic-provider.js';
export { OllamaProvider } from './ollama-provider.js';
export { VolcArkProvider } from './volcark-provider.js';
export { ProviderRouter, createProviderRouter } from './router.js';
export type { ProviderRouterOptions } from './router.js';
