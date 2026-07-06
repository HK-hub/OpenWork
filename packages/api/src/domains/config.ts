/**
 * Config 域 — 配置读写
 * 对应 06-详细设计文档 §4.2.4
 */
import { z } from 'zod';
import type { ConfigEntry } from '../types.js';

export const ConfigGetParams = z.object({
  key: z.string().optional(),
  profile: z.string().optional(),
});

export const ConfigSetParams = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  profile: z.string().optional(),
});

export const ConfigListParams = z.object({
  profile: z.string().optional(),
});

export const ConfigValidateParams = z.object({
  config: z.record(z.unknown()),
});

export interface ConfigGetResult {
  value: unknown;
}

export interface ConfigListResult {
  entries: ConfigEntry[];
}

export interface ConfigValidateResult {
  valid: boolean;
  errors: Array<{ path: string; message: string }>;
}

export interface ConfigDomain {
  'config.get': {
    params: z.infer<typeof ConfigGetParams>;
    result: ConfigGetResult;
  };
  'config.set': {
    params: z.infer<typeof ConfigSetParams>;
    result: { validated: true; oldValue: unknown };
  };
  'config.list': {
    params: z.infer<typeof ConfigListParams>;
    result: ConfigListResult;
  };
  'config.validate': {
    params: z.infer<typeof ConfigValidateParams>;
    result: ConfigValidateResult;
  };
}
