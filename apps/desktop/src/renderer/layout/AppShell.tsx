/**
 * AppShell — 应用整体布局 (三栏可调式 AI IDE 布局)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.1 AppShell + §12.9 预设布局
 *      09-LobeHub 生态集成方案 §1.2.2 Layout 组件体系
 *
 * 结构:
 *  ┌─────────────────────────────────────────────────┐
 *  │             TitleBar (40px,跨全宽)               │
 *  ├──────────┬───────────────────────┬──────────────┤
 *  │ LeftSide │ ContextStatusBar (36) │  RightPanel  │
 *  │  bar     ├───────────────────────┤   (可折叠)    │
 *  │ (折叠至  │      ChatList          │   360px      │
 *  │  48px)   │      (flex:1)          │              │
 *  │          ├───────────────────────┤              │
 *  │  240px   │     InputEditor        │              │
 *  └──────────┴───────────────────────┴──────────────┘
 *
 * v0.1 Phase 0.7.2 实现:
 *  - 基于 flexbox 自实现三栏布局 (简洁稳定)
 *  - 左右栏支持折叠/展开 (通过 ui-store 状态)
 *  - 暗色主题 (跟随 ThemeProvider)
 *
 * Phase 1+ 升级:
 *  - 替换为 @lobehub/ui Layout + DraggablePanel (支持拖拽调宽)
 *  - 布局状态持久化到 ~/.opencode/layout.json
 *  - 4 种预设模式 (focus / dev / review / debug)
 */
import { TitleBar } from './TitleBar';
import { LeftSidebar } from './LeftSidebar';
import { MainArea } from './MainArea';
import { RightPanel } from './RightPanel';
import { useUiStore } from '../stores/ui-store';

export function AppShell() {
  const rightCollapsed = useUiStore((s) => s.rightPanelCollapsed);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#1e1e1e',
        color: 'rgba(255,255,255,0.85)',
        overflow: 'hidden',
      }}
    >
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <LeftSidebar />
        <MainArea />
        {!rightCollapsed && <RightPanel />}
      </div>
    </div>
  );
}
