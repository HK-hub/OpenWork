/**
 * LeftSidebar — 左侧导航栏 (默认 240px,可折叠至 48px 图标条)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.3 LeftSidebar
 *
 * v0.1 Phase 0.7.2 骨架:
 *  - 上半部分: 4 个功能入口按钮 (Skills/Agents/MCP/New Task)
 *  - 中间: 搜索框 + 会话列表 (按时间分组占位)
 *  - 底部: Profile 切换器占位
 *
 * 折叠态: 仅显示功能入口图标 (48px 宽)
 */
import { ActionIcon, SearchBar, Avatar } from '@lobehub/ui';
import {
  ThunderboltOutlined,
  RobotOutlined,
  ApiOutlined,
  PlusOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useUiStore } from '../stores/ui-store';
import { useSessionStore, type SessionSummary } from '../stores/session-store';

const ACTION_ITEMS = [
  { key: 'skills', icon: <ThunderboltOutlined />, label: 'Skills' },
  { key: 'agents', icon: <RobotOutlined />, label: '智能体' },
  { key: 'mcp', icon: <ApiOutlined />, label: 'MCP' },
];

export function LeftSidebar() {
  const collapsed = useUiStore((s) => s.leftSidebarCollapsed);
  const sessions = useSessionStore((s) => s.sessions);
  const currentId = useSessionStore((s) => s.currentSessionId);
  const selectSession = useSessionStore((s) => s.selectSession);
  const createSession = useSessionStore((s) => s.createSession);

  if (collapsed) {
    // 折叠态: 仅 48px 宽图标条
    return (
      <div
        style={{
          width: 48,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 8,
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {ACTION_ITEMS.map((it) => (
          <ActionIcon key={it.key} icon={it.icon} title={it.label} />
        ))}
        <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <ActionIcon
          icon={<PlusOutlined />}
          title="新建任务"
          onClick={() => createSession()}
        />
      </div>
    );
  }

  // 展开态: 完整侧栏
  return (
    <div
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}
    >
      {/* 顶部:功能入口 */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '8px 8px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {ACTION_ITEMS.map((it) => (
          <ActionIcon
            key={it.key}
            icon={it.icon}
            title={it.label}
            style={{ flex: 1 }}
          />
        ))}
        <ActionIcon
          icon={<PlusOutlined />}
          title="新建任务"
          onClick={() => createSession()}
          style={{ flex: 1 }}
        />
      </div>

      {/* 搜索框 */}
      <div style={{ padding: '8px' }}>
        <SearchBar
          placeholder="搜索会话..."
          onChange={() => {
            /* v0.1: FTS5 全文检索 Phase 1 实现 */
          }}
        />
      </div>

      {/* 会话列表 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 4px' }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
            }}
          >
            暂无会话
            <br />
            <span style={{ fontSize: 11 }}>点击 + 新建任务</span>
          </div>
        ) : (
          <SessionGroup
            label="今天"
            sessions={sessions}
            currentId={currentId}
            onSelect={selectSession}
          />
        )}
      </div>

      {/* 底部:Profile */}
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Avatar icon={<UserOutlined />} size={24} />
        <div style={{ flex: 1, fontSize: 12 }}>
          <div style={{ color: 'rgba(255,255,255,0.85)' }}>Default Profile</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>claude-sonnet-4</div>
        </div>
      </div>
    </div>
  );
}

interface SessionGroupProps {
  label: string;
  sessions: SessionSummary[];
  currentId: string | null;
  onSelect: (id: string) => void;
}

function SessionGroup({ label, sessions, currentId, onSelect }: SessionGroupProps) {
  return (
    <div>
      <div
        style={{
          padding: '4px 12px',
          fontSize: 11,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      {sessions.map((s) => (
        <div
          key={s.id}
          onClick={() => onSelect(s.id)}
          style={{
            padding: '8px 12px',
            margin: '2px 4px',
            borderRadius: 4,
            cursor: 'pointer',
            background: s.id === currentId ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: s.id === currentId ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.65)',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            if (s.id !== currentId) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          }}
          onMouseLeave={(e) => {
            if (s.id !== currentId) e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {s.title}
          </div>
          {s.lastPreview && (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.lastPreview}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
