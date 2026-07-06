/**
 * ID 生成器 — 基于 nanoid
 *
 * 提供 typed ID 工厂,避免 string 与 ID 类型混淆。
 * 所有 ID 在数据库中均为字符串 (nanoid)。
 */
import { customAlphabet, nanoid } from 'nanoid';
import type { ID } from '@opencode/api';

// 不含易混字符的字母表 (去除 0/O/1/l/I)
const SAFE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
const safeId = customAlphabet(SAFE_ALPHABET, 16);

// 带前缀的 ID 工厂 (推荐,便于日志识别)
const PREFIXED = {
  ses: 'ses_',
  msg: 'msg_',
  run: 'run_',
  step: 'step_',
  tool: 'call_',
  cp: 'cp_',
  mem: 'mem_',
  proj: 'proj_',
  prof: 'prof_',
  audit: 'audit_',
  perm: 'perm_',
  appr: 'appr_',
} as const;

type Prefix = keyof typeof PREFIXED;

/** 生成带前缀的 ID (如 ses_abc123) */
export function genId(prefix: Prefix): ID {
  return `${PREFIXED[prefix]}${safeId()}`;
}

/** 生成不带前缀的 ID */
export function genRawId(size = 16): ID {
  return nanoid(size);
}

/** 生成 approval token (更长,避免碰撞) */
export function genApprovalToken(): string {
  return `appr_${customAlphabet(SAFE_ALPHABET, 32)()}`;
}

/** 生成 runId */
export function genRunId(): ID {
  return genId('run');
}

/** 生成 sessionId */
export function genSessionId(): ID {
  return genId('ses');
}

/** 生成 messageId */
export function genMessageId(): ID {
  return genId('msg');
}

/** 生成 stepId */
export function genStepId(): ID {
  return genId('step');
}

/** 生成 toolCallId */
export function genToolCallId(): ID {
  return genId('tool');
}

/** 生成 checkpointId */
export function genCheckpointId(): ID {
  return genId('cp');
}

/** 生成 memoryId */
export function genMemoryId(): ID {
  return genId('mem');
}

/** 生成 auditId */
export function genAuditId(): ID {
  return genId('audit');
}

/** 生成 permissionId */
export function genPermissionId(): ID {
  return genId('perm');
}

/** 生成 projectId */
export function genProjectId(): ID {
  return genId('proj');
}

/** 生成 profileId */
export function genProfileId(): ID {
  return genId('prof');
}
