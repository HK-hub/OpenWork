/**
 * Session Store — 会话状态 (Zustand)
 *
 * 管理:
 *  - 会话列表 (左侧栏显示)
 *  - 当前激活会话 ID
 *  - 当前会话消息列表 (ChatList 渲染)
 *  - 连接/加载状态
 *  - 新建会话 / 切换会话 / 追加消息 (流式)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.8.2 数据流 — session-store
 * 数据流: IPC notification (agent.event) → store.appendMessage() → ChatList 重渲染
 */
import { create } from 'zustand';
import type { ChatMessage } from '@lobehub/ui/chat';
import { getClient } from '../lib/client';

/** 构造 ChatMessage 的辅助函数 (补齐 BaseDataModel 必填字段) */
export function makeMessage(
  role: ChatMessage['role'],
  content: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  const now = Date.now();
  return {
    id: extra.id ?? `m_${now}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createAt: now,
    updateAt: now,
    meta: extra.meta ?? {},
    ...extra,
  } as ChatMessage;
}

/** 会话摘要 (左侧栏列表项) */
export interface SessionSummary {
  id: string;
  title: string;
  projectId: string;
  createdAt: number;
  updatedAt: number;
  /** 最后一条消息预览 (用于列表显示) */
  lastPreview?: string;
}

interface SessionState {
  // ── 会话列表 ──
  sessions: SessionSummary[];
  currentSessionId: string | null;
  isLoadingSessions: boolean;

  // ── 消息列表 (当前会话) ──
  messages: ChatMessage[];
  isStreaming: boolean;

  // ── 后端连接 ──
  connected: boolean;
  connectionError: string | null;

  // ── 动作 ──
  connect: () => Promise<void>;
  loadSessions: () => Promise<void>;
  createSession: (projectId?: string, title?: string) => Promise<string>;
  selectSession: (id: string) => void;
  appendMessage: (msg: ChatMessage) => void;
  updateLastAssistantContent: (delta: string) => void;
  clearMessages: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  isLoadingSessions: false,
  messages: [],
  isStreaming: false,
  connected: false,
  connectionError: null,

  connect: async () => {
    try {
      await getClient();
      set({ connected: true, connectionError: null });
    } catch (err) {
      set({ connected: false, connectionError: (err as Error).message });
    }
  },

  loadSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const client = await getClient();
      const result = await client.call('session.list', {
        projectId: 'proj_default',
        limit: 50,
      });
      const items = (result.items ?? []) as SessionSummary[];
      set({ sessions: items, isLoadingSessions: false });
    } catch (err) {
      console.error('[session-store] loadSessions failed:', err);
      set({ isLoadingSessions: false });
    }
  },

  createSession: async (projectId = 'proj_default', title = 'New Session') => {
    try {
      const client = await getClient();
      const result = await client.call('session.create', {
        projectId,
        title,
      });
      const newSession: SessionSummary = {
        id: result.sessionId,
        title,
        projectId,
        createdAt: result.createdAt ?? Date.now(),
        updatedAt: result.createdAt ?? Date.now(),
      };
      set((s) => ({
        sessions: [newSession, ...s.sessions],
        currentSessionId: result.sessionId,
        messages: [], // 新会话清空消息
      }));
      return result.sessionId;
    } catch (err) {
      console.error('[session-store] createSession failed:', err);
      throw err;
    }
  },

  selectSession: (id) => {
    set({ currentSessionId: id, messages: [] });
    // v0.1: 后续通过 session.get 加载消息历史;此处先清空
  },

  appendMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  updateLastAssistantContent: (delta) => {
    set((s) => {
      const msgs = [...s.messages];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m && m.role === 'assistant') {
          msgs[i] = { ...m, content: m.content + delta, updateAt: Date.now() };
          break;
        }
      }
      return { messages: msgs };
    });
  },

  clearMessages: () => set({ messages: [] }),
}));
