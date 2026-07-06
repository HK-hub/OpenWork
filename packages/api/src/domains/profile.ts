/**
 * Profile 域 — 配置档案
 * 对应 06-详细设计文档 §4.2.12
 */
import { z } from 'zod';
import type { Profile } from '../types.js';

export const ProfileListParams = z.object({});

export const ProfileCreateParams = z.object({
  name: z.string().min(1),
  base: z.string().optional(),
  provider: z.enum(['anthropic', 'openai', 'ollama', 'openai-compat', 'custom']),
  model: z.string().min(1),
  params: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().int().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

export const ProfileSwitchParams = z.object({
  profileId: z.string().min(1),
});

export const ProfileExportParams = z.object({
  profileId: z.string().min(1),
});

export const ProfileImportParams = z.object({
  source: z.string().min(1),
});

export interface ProfileListResult {
  profiles: Profile[];
}

export interface ProfileDomain {
  'profile.list': {
    params: z.infer<typeof ProfileListParams>;
    result: ProfileListResult;
  };
  'profile.create': {
    params: z.infer<typeof ProfileCreateParams>;
    result: { profileId: string };
  };
  'profile.switch': {
    params: z.infer<typeof ProfileSwitchParams>;
    result: { active: string };
  };
  'profile.export': {
    params: z.infer<typeof ProfileExportParams>;
    result: { url: string; bytes: number };
  };
  'profile.import': {
    params: z.infer<typeof ProfileImportParams>;
    result: { profileId: string };
  };
}
