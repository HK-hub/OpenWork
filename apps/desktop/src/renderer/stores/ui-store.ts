/**
 * UI Store — 布局状态 (Zustand)
 *
 * 管理:
 *  - 左侧栏 / 右侧栏的折叠状态与宽度
 *  - 右侧栏当前激活的 Tab
 *  - 上下文 Token 占用 (实时更新)
 *  - 主题模式 (深色/浅色/跟随系统)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.8.2 数据流 — ui-store
 * 持久化: v0.1 简化版仅在内存,后续接入 ~/.opencode/layout.json
 */
import { create } from 'zustand';

/** 右侧栏 Tab 标识 */
export type RightPanelTab = 'explorer' | 'diff' | 'markdown' | 'scm' | 'agent-status';

/** 主题模式 */
export type ThemeMode = 'dark' | 'light' | 'auto';

/** Agent 输入模式 */
export type AgentMode = 'ask' | 'plan' | 'build' | 'review';

interface UiState {
  // ── 左侧栏 ──
  leftSidebarCollapsed: boolean;
  leftSidebarWidth: number;
  toggleLeftSidebar: () => void;
  setLeftSidebarWidth: (w: number) => void;

  // ── 右侧栏 ──
  rightPanelCollapsed: boolean;
  rightPanelWidth: number;
  activeRightTab: RightPanelTab;
  toggleRightPanel: () => void;
  setRightPanelWidth: (w: number) => void;
  setActiveRightTab: (tab: RightPanelTab) => void;

  // ── 主题 ──
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;

  // ── Agent 输入模式 ──
  agentMode: AgentMode;
  setAgentMode: (mode: AgentMode) => void;

  // ── 上下文 Token 占用 ──
  contextTokensUsed: number;
  contextTokensLimit: number;
  setContextTokensUsed: (used: number) => void;
}

const DEFAULT_LEFT_WIDTH = 240;
const DEFAULT_RIGHT_WIDTH = 360;

export const useUiStore = create<UiState>((set) => ({
  // 左侧栏
  leftSidebarCollapsed: false,
  leftSidebarWidth: DEFAULT_LEFT_WIDTH,
  toggleLeftSidebar: () =>
    set((s) => ({ leftSidebarCollapsed: !s.leftSidebarCollapsed })),
  setLeftSidebarWidth: (w) => set({ leftSidebarWidth: w }),

  // 右侧栏
  rightPanelCollapsed: false,
  rightPanelWidth: DEFAULT_RIGHT_WIDTH,
  activeRightTab: 'explorer',
  toggleRightPanel: () =>
    set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
  setRightPanelWidth: (w) => set({ rightPanelWidth: w }),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),

  // 主题
  themeMode: 'dark',
  setThemeMode: (mode) => set({ themeMode: mode }),

  // Agent 模式
  agentMode: 'build',
  setAgentMode: (mode) => set({ agentMode: mode }),

  // 上下文 Token
  contextTokensUsed: 0,
  contextTokensLimit: 128_000,
  setContextTokensUsed: (used) => set({ contextTokensUsed: used }),
}));
