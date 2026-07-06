/**
 * RightPanel — 右侧功能面板 (默认 360px,5 个 Tab)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.7 RightPanel
 *
 * v0.1 Phase 0.7.2 骨架: 5 个 Tab 占位 + 终端/浏览器按钮占位
 *  - 📂 资源管理器 (项目文件树)
 *  - 🔀 变更 Diff (Monaco DiffEditor)
 *  - 📝 Markdown 预览
 *  - 🌿 源代码管理 (simple-git)
 *  - 📊 AI 状态监控
 *
 * Phase 1+ 实现: 终端 (xterm.js) / 浏览器 (BrowserView) / 完整 Tab 内容
 */
import { Tabs, ActionIcon } from '@lobehub/ui';
import {
  AppstoreOutlined,
  FileTextOutlined,
  SwapOutlined,
  BranchesOutlined,
  DashboardOutlined,
  CodeOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useUiStore, type RightPanelTab } from '../stores/ui-store';
import { useAgentStore } from '../stores/agent-store';

const TAB_ITEMS: { key: RightPanelTab; label: string; icon: React.ReactNode }[] = [
  { key: 'explorer', label: '资源', icon: <AppstoreOutlined /> },
  { key: 'diff', label: 'Diff', icon: <SwapOutlined /> },
  { key: 'markdown', label: '预览', icon: <FileTextOutlined /> },
  { key: 'scm', label: 'Git', icon: <BranchesOutlined /> },
  { key: 'agent-status', label: 'AI', icon: <DashboardOutlined /> },
];

export function RightPanel() {
  const activeTab = useUiStore((s) => s.activeRightTab);
  const setActiveTab = useUiStore((s) => s.setActiveRightTab);

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* 顶部工具按钮: 终端 / 浏览器 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <ActionIcon icon={<CodeOutlined />} title="终端 (Phase 1+)" />
        <ActionIcon icon={<GlobalOutlined />} title="浏览器 (Phase 1+)" />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>v0.1 占位</span>
      </div>

      {/* Tab 切换 */}
      <Tabs
        size="small"
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as RightPanelTab)}
        items={TAB_ITEMS.map((t) => ({
          key: t.key,
          label: (
            <span>
              {t.icon}
              <span style={{ marginLeft: 4 }}>{t.label}</span>
            </span>
          ),
          children: <TabContent tab={t.key} />,
        }))}
        tabBarStyle={{ margin: '0 8px' }}
      />
    </div>
  );
}

function TabContent({ tab }: { tab: RightPanelTab }) {
  switch (tab) {
    case 'explorer':
      return <Placeholder title="资源管理器" hint="项目文件树 + Monaco 预览 (Phase 1+)" />;
    case 'diff':
      return <Placeholder title="变更 Diff" hint="Agent 文件变更,Monaco DiffEditor (Phase 1+)" />;
    case 'markdown':
      return <Placeholder title="Markdown 预览" hint="@lobehub/ui/mdx 渲染 (Phase 1+)" />;
    case 'scm':
      return <Placeholder title="源代码管理" hint="simple-git 暂存/提交 (Phase 1+)" />;
    case 'agent-status':
      return <AgentStatusContent />;
    default:
      return null;
  }
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div
      style={{
        padding: 24,
        textAlign: 'center',
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12,
      }}
    >
      <div style={{ fontSize: 14, marginBottom: 6, color: 'rgba(255,255,255,0.65)' }}>{title}</div>
      <div>{hint}</div>
    </div>
  );
}

function AgentStatusContent() {
  const status = useAgentStore((s) => s.status);
  const runId = useAgentStore((s) => s.runId);
  const phase = useAgentStore((s) => s.phase);
  const iteration = useAgentStore((s) => s.iteration);
  const maxIter = useAgentStore((s) => s.maxIterations);
  const cost = useAgentStore((s) => s.costUsd);
  const toolCalls = useAgentStore((s) => s.toolCalls);

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 4 }}>
        <div style={{ marginBottom: 4, color: 'rgba(255,255,255,0.85)' }}>
          状态: <b style={{ color: status === 'running' ? '#22c55e' : 'inherit' }}>{status}</b>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)' }}>
          runId: <code style={{ fontSize: 11 }}>{runId ?? '—'}</code>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.55)' }}>
          阶段: <code>{phase ?? '—'}</code>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>迭代</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div
              style={{
                width: `${(iteration / maxIter) * 100}%`,
                height: '100%',
                background: '#2c6fbb',
                borderRadius: 2,
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>
            {iteration} / {maxIter}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>成本</div>
        <div style={{ fontSize: 13, color: '#f59e0b' }}>${cost.toFixed(4)} USD</div>
      </div>

      <div>
        <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>工具调用 ({toolCalls.length})</div>
        {toolCalls.length === 0 ? (
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>暂无工具调用</div>
        ) : (
          <div>
            {toolCalls.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                style={{
                  padding: '4px 8px',
                  marginBottom: 2,
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 3,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <code style={{ fontSize: 11 }}>{c.name}</code>
                <span
                  style={{
                    fontSize: 11,
                    color:
                      c.status === 'completed'
                        ? '#22c55e'
                        : c.status === 'error'
                          ? '#ef4444'
                          : '#f59e0b',
                  }}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
