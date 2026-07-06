/**
 * Agent Store — Agent Loop 状态 (Zustand)
 *
 * 管理:
 *  - 当前运行状态 (idle / running / paused / error)
 *  - 当前运行的 runId
 *  - 当前 PAOR 阶段 (perceive / act / observe / reflect)
 *  - 当前迭代次数与预算使用
 *  - 工具调用统计
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.8.2 数据流 — agent-store
 * 数据流: Backend 通过 agent.event notification 推送 → store 更新 → ContextStatusBar / RightPanel 订阅
 */
import { create } from 'zustand';

export type RunStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';
export type LoopPhase = 'perceive' | 'act' | 'observe' | 'reflect';

/** 一次工具调用统计 */
export interface ToolCallStat {
  name: string;
  status: 'pending' | 'awaiting_approval' | 'running' | 'completed' | 'error';
  riskLevel?: 'L0' | 'L1' | 'L2' | 'L3';
}

interface AgentState {
  status: RunStatus;
  runId: string | null;
  phase: LoopPhase | null;
  iteration: number;
  maxIterations: number;
  costUsd: number;
  budgetHardCapUsd: number;
  toolCalls: ToolCallStat[];

  setStatus: (s: RunStatus) => void;
  setRun: (runId: string) => void;
  setPhase: (p: LoopPhase) => void;
  incrementIteration: () => void;
  addCost: (usd: number) => void;
  addToolCall: (stat: ToolCallStat) => void;
  updateToolCall: (name: string, patch: Partial<ToolCallStat>) => void;
  reset: () => void;
}

const INITIAL: Pick<
  AgentState,
  'status' | 'runId' | 'phase' | 'iteration' | 'maxIterations' | 'costUsd' | 'budgetHardCapUsd' | 'toolCalls'
> = {
  status: 'idle',
  runId: null,
  phase: null,
  iteration: 0,
  maxIterations: 25,
  costUsd: 0,
  budgetHardCapUsd: 10,
  toolCalls: [],
};

export const useAgentStore = create<AgentState>((set, get) => ({
  ...INITIAL,
  setStatus: (s) => set({ status: s }),
  setRun: (runId) => set({ runId }),
  setPhase: (p) => set({ phase: p }),
  incrementIteration: () => set((s) => ({ iteration: s.iteration + 1 })),
  addCost: (usd) => set((s) => ({ costUsd: s.costUsd + usd })),
  addToolCall: (stat) => set((s) => ({ toolCalls: [...s.toolCalls, stat] })),
  updateToolCall: (name, patch) =>
    set((s) => ({
      toolCalls: s.toolCalls.map((c) => (c.name === name ? { ...c, ...patch } : c)),
    })),
  reset: () => set({ ...INITIAL }),
}));
