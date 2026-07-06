/**
 * MainArea — 中间主交互区
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.5 MainArea
 *
 * 结构 (从上到下):
 *  - ContextStatusBar (36px,固定在顶部)
 *  - ChatList 消息流 (flex:1,虚拟滚动 Phase 1+)
 *  - InputEditor 输入编辑器 (底部,160-400px)
 *
 * v0.1 Phase 0.7.2: 空会话显示欢迎卡片,有消息时显示 @lobehub/ui ChatList
 */
import { ChatList } from '@lobehub/ui/chat';
import { ContextStatusBar } from './ContextStatusBar';
import { InputEditor } from './InputEditor';
import { useSessionStore, makeMessage } from '../stores/session-store';
import { useUiStore } from '../stores/ui-store';
import { useConfigStore } from '../stores/config-store';

export function MainArea() {
  const messages = useSessionStore((s) => s.messages);
  const createSession = useSessionStore((s) => s.createSession);
  const appendMessage = useSessionStore((s) => s.appendMessage);
  const currentSessionId = useSessionStore((s) => s.currentSessionId);

  const agentMode = useUiStore((s) => s.agentMode);
  const currentModelId = useConfigStore((s) => s.currentModelId);

  // 空状态欢迎卡片
  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ContextStatusBar />
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            overflow: 'auto',
          }}
        >
          <WelcomeCard
            onPick={(prompt) => {
              if (!currentSessionId) {
                void createSession().then(() => {
                  appendMessage(makeMessage('user', prompt));
                });
              } else {
                appendMessage(makeMessage('user', prompt));
              }
            }}
            agentMode={agentMode}
            modelName={currentModelId}
          />
        </div>
        <InputEditor />
      </div>
    );
  }

  // 有消息时显示 ChatList
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ContextStatusBar />
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 0' }}>
        <ChatList
          data={messages}
          showTitle={false}
          variant="bubble"
        />
      </div>
      <InputEditor />
    </div>
  );
}

interface WelcomeCardProps {
  onPick: (prompt: string) => void;
  agentMode: string;
  modelName: string;
}

const SUGGESTIONS = [
  {
    title: '理解代码库',
    prompt: '请帮我分析当前项目的整体架构,梳理核心模块与依赖关系',
    icon: '📦',
  },
  {
    title: '修复 Bug',
    prompt: '我遇到了一个错误,请帮我定位并修复',
    icon: '🐛',
  },
  {
    title: '新增功能',
    prompt: '请帮我新增一个功能,先规划再实现',
    icon: '✨',
  },
  {
    title: '代码审查',
    prompt: '请审查我最近的代码改动,指出可优化的地方',
    icon: '🔍',
  },
];

function WelcomeCard({ onPick, agentMode, modelName }: WelcomeCardProps) {
  return (
    <div style={{ maxWidth: 720, width: '100%', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⌬</div>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          margin: '0 0 8px',
          color: 'rgba(255,255,255,0.95)',
        }}
      >
        OpenCoding Agent
      </h1>
      <p
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.5)',
          marginBottom: 32,
        }}
      >
        嵌入式 AI 编程助手 · 模型 {modelName} · 模式 {agentMode}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          textAlign: 'left',
        }}
      >
        {SUGGESTIONS.map((s) => (
          <div
            key={s.title}
            onClick={() => onPick(s.prompt)}
            style={{
              padding: 16,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.borderColor = 'rgba(44,111,187,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
            }}
          >
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 4 }}>
              {s.title}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {s.prompt}
            </div>
          </div>
        ))}
      </div>

      <p
        style={{
          marginTop: 24,
          fontSize: 11,
          color: 'rgba(255,255,255,0.3)',
        }}
      >
        v0.1 骨架 · Phase 0.7.2 · 端到端 IPC 通信已就绪,Agent Loop 在 Phase 1 接入
      </p>
    </div>
  );
}
