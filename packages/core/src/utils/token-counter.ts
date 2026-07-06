/**
 * Token 计数器 — 估算 token 数量
 *
 * v0.1 使用启发式估算 (4 chars ≈ 1 token for English, 1.5 chars ≈ 1 token for CJK)
 * 精确计数由 Provider SDK 返回 (usage 字段),这里仅用于预算预估。
 */
export interface TokenCount {
  input: number;
  output: number;
}

/** 估算文本 token 数 (粗略,精确值以模型返回 usage 为准) */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // CJK 字符 (中日韩): 大约 1.5 字符 ≈ 1 token
  // ASCII 字符: 大约 4 字符 ≈ 1 token
  const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const otherCount = text.length - cjkCount;
  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

/** 估算消息内容 token 数 (含 role 等开销) */
export function estimateMessageTokens(content: string, role: string): number {
  // 每条消息固定开销 ~4 token (role + structure)
  const roleOverhead = 4;
  return estimateTokens(content) + roleOverhead + estimateTokens(role);
}

/** 计算成本 (USD) */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: { inputPer1k?: number; outputPer1k?: number },
): number {
  const inputCost = (inputTokens / 1000) * (pricing.inputPer1k ?? 0);
  const outputCost = (outputTokens / 1000) * (pricing.outputPer1k ?? 0);
  return Math.round((inputCost + outputCost) * 1e6) / 1e6; // 保留 6 位小数
}

/** 已知模型的定价 (USD per 1K tokens) */
export const MODEL_PRICING: Record<string, { inputPer1k: number; outputPer1k: number }> = {
  'claude-3-5-sonnet-20241022': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-haiku-20241022': { inputPer1k: 0.001, outputPer1k: 0.005 },
  'claude-3-opus-20240229': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'gpt-4o': { inputPer1k: 0.0025, outputPer1k: 0.01 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
};

/** 获取模型定价 (未知模型返回 0) */
export function getModelPricing(model: string): { inputPer1k: number; outputPer1k: number } {
  return MODEL_PRICING[model] ?? { inputPer1k: 0, outputPer1k: 0 };
}
