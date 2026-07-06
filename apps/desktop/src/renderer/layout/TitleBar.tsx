/**
 * TitleBar — 顶部窗口栏 (40px 高,跨全宽)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.2 TitleBar 设计
 *
 * v0.1 Phase 0.7.2 骨架实现:
 *  - 左侧: Logo + 左栏折叠按钮 + 项目标题
 *  - 中间: 工作目录 + Git 分支占位
 *  - 右侧: 后端连接状态 + 外部 IDE 跳转按钮占位
 *
 * 后续版本补充:
 *  - 会话标题 (双击重命名) / 实时 Git 分支读取
 *  - frame:false 自定义窗口控制按钮 (─ □ ✕)
 *  - 外部 IDE 跳转 (shell.openPath)
 */
import { ActionIcon, ActionIconGroup } from '@lobehub/ui';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
  GithubOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { useUiStore } from '../stores/ui-store';
import { useConfigStore } from '../stores/config-store';
import { useSessionStore } from '../stores/session-store';

const dragStyle = { WebkitAppRegion: 'drag' as const } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: 'no-drag' as const } as React.CSSProperties;

export function TitleBar() {
  const leftCollapsed = useUiStore((s) => s.leftSidebarCollapsed);
  const rightCollapsed = useUiStore((s) => s.rightPanelCollapsed);
  const toggleLeft = useUiStore((s) => s.toggleLeftSidebar);
  const toggleRight = useUiStore((s) => s.toggleRightPanel);
  const projectTitle = useConfigStore((s) => s.projectTitle);
  const workingDir = useConfigStore((s) => s.workingDirectory);
  const connected = useSessionStore((s) => s.connected);

  return (
    <div
      style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        gap: 8,
        userSelect: 'none',
        ...dragStyle,
      }}
    >
      {/* 左侧:折叠 + Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDragStyle }}>
        <ActionIcon
          icon={leftCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={toggleLeft}
          title={leftCollapsed ? '展开左栏' : '折叠左栏'}
        />
        <span style={{ fontWeight: 600, fontSize: 13 }}>⌬ {projectTitle}</span>
      </div>

      {/* 中间:工作目录 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
          color: 'rgba(255,255,255,0.55)',
          fontSize: 12,
        }}
      >
        <span title={workingDir}>
          <FolderOpenOutlined style={{ marginRight: 4 }} />
          {truncatePath(workingDir)}
        </span>
        <span style={{ opacity: 0.4 }}>│</span>
        <span>
          <GithubOutlined style={{ marginRight: 4 }} />
          main
        </span>
      </div>

      {/* 右侧:后端状态 + 右栏折叠 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDragStyle }}>
        <span
          style={{
            fontSize: 11,
            padding: '2px 8px',
            borderRadius: 4,
            background: connected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: connected ? '#22c55e' : '#ef4444',
          }}
        >
          {connected ? '● 后端已连接' : '○ 后端未连接'}
        </span>
        <ActionIconGroup
          items={[
            {
              key: 'toggle-right',
              icon: <RightOutlined />,
              onClick: toggleRight,
              title: rightCollapsed ? '展开右栏' : '折叠右栏',
            },
          ]}
        />
      </div>
    </div>
  );
}

function truncatePath(p: string, max = 32): string {
  if (p.length <= max) return p;
  return '…' + p.slice(p.length - max + 1);
}
