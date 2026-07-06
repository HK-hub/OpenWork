/**
 * ContextStatusBar — 上下文状态栏 (36px 高,位于 MainArea 顶部)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.4 ContextStatusBar
 *
 * 元素:
 *  - 📊 上下文窗口进度条 (实时 Token 占用;颜色随占用率变化)
 *  - 🤖 模型切换器
 *  - ⚙ 权限模式切换器
 */
import { Segmented, Select, Tooltip } from '@lobehub/ui';
import { useConfigStore, type PermissionMode } from '../stores/config-store';
import { useUiStore } from '../stores/ui-store';
import { useAgentStore } from '../stores/agent-store';

const PERMISSION_MODES: { value: PermissionMode; label: string; tip: string }[] = [
  { value: 'approve', label: '批准', tip: '每个工具调用都需用户批准' },
  { value: 'auto', label: '自动', tip: 'L0/L1 自动批准,L2+ 询问' },
  { value: 'ask', label: '询问', tip: '每次工具调用前先询问' },
  { value: 'trust', label: '信任', tip: '完全自动执行 (危险)' },
];

const AGENT_MODES = [
  { value: 'ask', label: 'Ask' },
  { value: 'plan', label: 'Plan' },
  { value: 'build', label: 'Build' },
  { value: 'review', label: 'Review' },
];

export function ContextStatusBar() {
  const models = useConfigStore((s) => s.models);
  const currentModelId = useConfigStore((s) => s.currentModelId);
  const setCurrentModel = useConfigStore((s) => s.setCurrentModel);
  const permissionMode = useConfigStore((s) => s.permissionMode);
  const setPermissionMode = useConfigStore((s) => s.setPermissionMode);

  const agentMode = useUiStore((s) => s.agentMode);
  const setAgentMode = useUiStore((s) => s.setAgentMode);
  const used = useUiStore((s) => s.contextTokensUsed);
  const limit = useUiStore((s) => s.contextTokensLimit);

  const runStatus = useAgentStore((s) => s.status);
  const iteration = useAgentStore((s) => s.iteration);
  const maxIter = useAgentStore((s) => s.maxIterations);
  const cost = useAgentStore((s) => s.costUsd);

  const pct = Math.min(100, (used / limit) * 100);
  const barColor = pct < 70 ? '#22c55e' : pct < 90 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        height: 36,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 16,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        background: 'rgba(0,0,0,0.15)',
      }}
    >
      {/* 运行状态 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: runStatus === 'running' ? '#22c55e' : runStatus === 'error' ? '#ef4444' : '#6b7280',
            boxShadow: runStatus === 'running' ? '0 0 6px #22c55e' : 'none',
          }}
        />
        {runStatus}
        {runStatus === 'running' && (
          <span style={{ opacity: 0.6 }}>
            · {iteration}/{maxIter} iter · ${cost.toFixed(3)}
          </span>
        )}
      </span>

      <span style={{ opacity: 0.3 }}>│</span>

      {/* Agent 模式切换 */}
      <Segmented
        size="small"
        value={agentMode}
        onChange={(v) => setAgentMode(v as typeof agentMode)}
        options={AGENT_MODES}
      />

      <span style={{ opacity: 0.3 }}>│</span>

      {/* 上下文进度条 */}
      <Tooltip title={`${formatNumber(used)} / ${formatNumber(limit)} tokens`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200 }}>
          <span style={{ opacity: 0.7 }}>📊</span>
          <div
            style={{
              flex: 1,
              height: 6,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${pct}%`,
                height: '100%',
                background: barColor,
                transition: 'width 0.3s ease, background 0.3s ease',
              }}
            />
          </div>
          <span style={{ minWidth: 80, fontVariantNumeric: 'tabular-nums' }}>
            {formatNumber(used)} / {formatNumber(limit)}
          </span>
        </div>
      </Tooltip>

      <span style={{ opacity: 0.3 }}>│</span>

      {/* 模型选择器 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ opacity: 0.7 }}>🤖</span>
        <Select
          size="small"
          value={currentModelId}
          onChange={setCurrentModel}
          style={{ minWidth: 180 }}
          options={models.map((m) => ({
            value: m.id,
            label: m.displayName,
          }))}
        />
      </span>

      <span style={{ opacity: 0.3 }}>│</span>

      {/* 权限模式 */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ opacity: 0.7 }}>⚙</span>
        <Segmented
          size="small"
          value={permissionMode}
          onChange={(v) => setPermissionMode(v as PermissionMode)}
          options={PERMISSION_MODES.map((m) => ({ value: m.value, label: m.label }))}
        />
      </span>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
