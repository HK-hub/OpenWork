/**
 * InputEditor — 输入编辑器 (位于 MainArea 底部,160-400px 可调)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.6 InputEditor
 *
 * v0.1 Phase 0.7.2 骨架:
 *  - 顶部: 附件按钮占位 + Agent 模式切换 (从 ui-store 读取)
 *  - 中部: 简易 textarea (Phase 1+ 替换为 @lobehub/editor Lexical)
 *  - 底部: 工作目录 + 发送按钮
 *
 * Phase 1+ 待补充:
 *  - @lobehub/editor Lexical 富文本
 *  - `/命令` / `@文件` / `#智能体` 芯片
 *  - 附件预览 / 拖拽上传
 *  - 历史回溯 (↑/↓)
 *  - 上拉调高 (resizable)
 */
import { useState, useRef, type KeyboardEvent } from 'react';
import { ActionIcon, Tooltip } from '@lobehub/ui';
import {
  PaperClipOutlined,
  ArrowUpOutlined,
  StopOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { useUiStore } from '../stores/ui-store';
import { useConfigStore } from '../stores/config-store';
import { useAgentStore } from '../stores/agent-store';
import { useSessionStore, makeMessage } from '../stores/session-store';
import { getClient } from '../lib/client';
import type { AgentStreamChunk, AgentStreamEnd } from '@opencode/api';

export function InputEditor() {
  const [value, setValue] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);

  const agentMode = useUiStore((s) => s.agentMode);
  const setAgentMode = useUiStore((s) => s.setAgentMode);
  const workingDir = useConfigStore((s) => s.workingDirectory);
  const currentModelId = useConfigStore((s) => s.currentModelId);
  const models = useConfigStore((s) => s.models);

  const runStatus = useAgentStore((s) => s.status);
  const setStatus = useAgentStore((s) => s.setStatus);
  const setRun = useAgentStore((s) => s.setRun);
  const addCost = useAgentStore((s) => s.addCost);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);
  const createSession = useSessionStore((s) => s.createSession);
  const appendMessage = useSessionStore((s) => s.appendMessage);
  const updateLastAssistantContent = useSessionStore((s) => s.updateLastAssistantContent);

  const isRunning = runStatus === 'running';
  const currentModel = models.find((m) => m.id === currentModelId);
  const canSend = value.trim().length > 0 && !isRunning;

  async function handleSend() {
    if (!canSend) return;
    const text = value.trim();
    setValue('');

    // 先确保有会话 (没有则创建)
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = await createSession();
    }

    // 立即追加用户消息到 UI (乐观更新)
    appendMessage(makeMessage('user', text));

    // 追加空的 assistant 消息占位 (流式响应会逐步填充)
    appendMessage(makeMessage('assistant', ''));

    // 启动 agent.run 流式调用
    setStatus('running');
    setRun(''); // 占位,实际 runId 在 stream end 时才知道
    try {
      const client = await getClient();
      // 解析 currentModelId (支持两种格式: 'provider/model' 或纯 model id)
      // 若带 provider 前缀则拆分,否则交由后端 ProviderRouter 按模型前缀路由
      const slashIdx = currentModelId.indexOf('/');
      const provider = slashIdx > -1 ? currentModelId.slice(0, slashIdx) : undefined;
      const modelName = slashIdx > -1 ? currentModelId.slice(slashIdx + 1) : currentModelId;

      const stream = client.stream('agent.run', {
        sessionId,
        prompt: text,
        mode: agentMode,
        model: modelName,
        provider,
        stream: true,
      });

      for await (const evt of stream) {
        const e = evt as AgentStreamChunk | AgentStreamEnd;
        if (e.stream === 'chunk' && e.delta) {
          updateLastAssistantContent(e.delta);
        } else if (e.stream === 'end') {
          const end = e as AgentStreamEnd;
          if (end.usage) {
            addCost(end.usage.costUsd ?? 0);
          }
          if (end.runId) {
            setRun(end.runId);
          }
          setStatus(end.status === 'running' ? 'completed' : (end.status as 'completed' | 'stopped' | 'error'));
        }
      }
    } catch (err) {
      console.error('[InputEditor] agent.run failed:', err);
      setStatus('error');
      // 在 assistant 占位消息中显示错误信息
      updateLastAssistantContent(`\n\n[Error] ${(err as Error).message}`);
    }
  }

  async function handleStop() {
    const runId = useAgentStore.getState().runId;
    if (!runId) {
      setStatus('stopped');
      return;
    }
    try {
      const client = await getClient();
      await client.call('agent.stop', { runId, reason: 'user_clicked_stop' });
    } catch (err) {
      console.error('[InputEditor] agent.stop failed:', err);
    } finally {
      setStatus('stopped');
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送,Shift+Enter 换行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.15)',
        padding: '8px 12px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* 顶部工具栏: 附件 + 模式 + 模型 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <ActionIcon icon={<PaperClipOutlined />} title="附件 (Phase 1+)" />
        <span style={{ opacity: 0.3 }}>│</span>
        <span style={{ color: 'rgba(255,255,255,0.65)' }}>模式:</span>
        <select
          value={agentMode}
          onChange={(e) => setAgentMode(e.target.value as typeof agentMode)}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.85)',
            borderRadius: 4,
            padding: '1px 6px',
            fontSize: 11,
            cursor: 'pointer',
          }}
        >
          <option value="ask">ask — 仅问答</option>
          <option value="plan">plan — 先规划再执行</option>
          <option value="build">build — 直接执行</option>
          <option value="review">review — 只读分析</option>
        </select>
        <span style={{ opacity: 0.3 }}>│</span>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>🤖 {currentModel?.displayName ?? currentModelId}</span>
      </div>

      {/* 编辑区 */}
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`输入消息... (Enter 发送, Shift+Enter 换行)\n\n当前模式: ${agentMode}`}
        style={{
          width: '100%',
          minHeight: 80,
          maxHeight: 240,
          resize: 'vertical',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          padding: '8px 10px',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: 'inherit',
          fontSize: 13,
          lineHeight: 1.5,
          outline: 'none',
        }}
      />

      {/* 底部状态栏 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 11,
          color: 'rgba(255,255,255,0.45)',
        }}
      >
        <span title={workingDir}>📁 {shortenPath(workingDir)}</span>
        <span style={{ opacity: 0.3 }}>│</span>
        <Tooltip title="历史输入 (↑/↓ 切换) — Phase 1+">
          <span style={{ cursor: 'help' }}>
            <HistoryOutlined /> 历史
          </span>
        </Tooltip>
        <div style={{ flex: 1 }} />
        {isRunning ? (
          <button
            type="button"
            onClick={() => void handleStop()}
            style={{
              padding: '4px 12px',
              border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <StopOutlined /> 停止
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              padding: '4px 12px',
              border: 'none',
              background: canSend ? '#2c6fbb' : 'rgba(255,255,255,0.08)',
              color: canSend ? '#fff' : 'rgba(255,255,255,0.35)',
              borderRadius: 4,
              cursor: canSend ? 'pointer' : 'not-allowed',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ArrowUpOutlined /> 发送 ↵
          </button>
        )}
      </div>
    </div>
  );
}

function shortenPath(p: string, max = 28): string {
  if (p.length <= max) return p;
  const parts = p.replace(/\\/g, '/').split('/');
  if (parts.length <= 2) return p;
  return '…/' + parts.slice(-2).join('/');
}
