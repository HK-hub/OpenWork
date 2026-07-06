/**
 * App 根组件 — v0.1 三栏布局版 (Phase 0.7.2)
 *
 * 职责:
 *  1. 注入 ThemeProvider (暗色主题 + antd v6 token 覆盖)
 *  2. 启动时连接后端 (OpenCodeClient via IPC)
 *  3. 渲染 AppShell (三栏布局)
 *  4. 加载会话列表 (从后端 session.list 拉取)
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.10 主题方案 + §12.1 AppShell
 */
import { useEffect } from 'react';
import { ThemeProvider } from '@lobehub/ui';
import { AppShell } from './layout/AppShell';
import { antdTheme, opencodeToken } from './theme';
import { useSessionStore } from './stores/session-store';
import { useUiStore } from './stores/ui-store';

export default function App() {
  const themeMode = useUiStore((s) => s.themeMode);
  const connect = useSessionStore((s) => s.connect);
  const loadSessions = useSessionStore((s) => s.loadSessions);

  useEffect(() => {
    void (async () => {
      await connect();
      await loadSessions();
    })();
  }, [connect, loadSessions]);

  return (
    <ThemeProvider
      themeMode={themeMode}
      theme={antdTheme}
      customToken={() => opencodeToken}
      enableGlobalStyle
      style={{
        position: 'fixed',
        inset: 0,
        background: '#1e1e1e',
      }}
    >
      <AppShell />
    </ThemeProvider>
  );
}
