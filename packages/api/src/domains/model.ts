/**
 * Model 域 — 模型管理
 * 对应 06-详细设计文档 §4.2.15
 */
import { z } from 'zod';

export const ModelListParams = z.object({
  provider: z.string().optional(),
});

export const ModelTestParams = z.object({
  model: z.string().min(1),
  prompt: z.string().default('Hello'),
});

export const ModelCostParams = z.object({
  model: z.string().min(1),
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
});

export interface ModelInfo {
  provider: string;
  name: string;
  contextWindow: number;
  inputPricePer1k?: number;
  outputPricePer1k?: number;
  capabilities?: string[];
}

export interface ModelDomain {
  'model.list': {
    params: z.infer<typeof ModelListParams>;
    result: { models: ModelInfo[] };
  };
  'model.test': {
    params: z.infer<typeof ModelTestParams>;
    result: { ok: boolean; latencyMs: number; usage?: { input: number; output: number } };
  };
  'model.cost': {
    params: z.infer<typeof ModelCostParams>;
    result: { costUsd: number };
  };
}
