# OpenCoding — LobeHub 生态集成方案

> **文档版本**: v1.3 (清理历史决策修订记录，统一为最新决策)
> **文档类型**: 技术集成决策文档
> **编写日期**: 2026-06-30 (v1.0) / 2026-07-01 (v1.1) / 2026-07-01 (v1.2) / 2026-07-02 (v1.3)
> **基于**: 用户指定的 8 个 LobeHub 生态包调研结果 + LobeHub 官方 React 组件编写指南
> **关联文档**: [08-技术选型与架构方案(实施版).md](./08-技术选型与架构方案(实施版).md) (v3.6)

> **v1.3 变更说明**: 清理历史决策修订记录（删除 §A.2 v1.1 决策修订记录、§A.3 v1.2 决策修订记录），统一为最新决策；明确 antd v6 + antd-style 仅作为 @lobehub/ui 底层依赖存在，禁止直接使用其原生组件 API。刷新跨文档版本号引用（M18 修复）：关联文档 08 由 v3.4 更新为 v3.6。

> **v1.2 变更说明**: 根据用户决策，**禁止将 antd v6 + antd-style 作为首选 UI 框架**。遵循 [LobeHub 官方 React 组件编写指南](https://www.skills.sh/lobehub/lobehub/react)，UI 框架优先级调整为：**LobeHub UI（base-ui 无头原语优先）→ @lobehub/ui 高级组件 → 基于 LobeHub UI 封装 → antd v6 兜底 → 自定义实现**。新增 §0.4「UI 组件优先级策略」章节。

---

## 目录

- [0. 调研总览与结论](#0-调研总览与结论)
- [1. @lobehub/ui — 核心 UI 组件库](#1-lobehubui--核心-ui-组件库)
- [2. @lobehub/icons — AI/LLM 品牌图标库](#2-lobehubicons--aillm-品牌图标库)
- [3. @lobehub/charts — 图表组件库](#3-lobehubcharts--图表组件库)
- [4. @lobehub/editor — AI 交互输入编辑器](#4-lobehubeditor--ai-交互输入编辑器)
- [5. @lobehub/tts — 语音合成/识别库](#5-lobehubtts--语音合成识别库)
- [6. @lobehub/lint — 代码规范工具集](#6-lobehublint--代码规范工具集)
- [7. @lobehub/chat-plugin-sdk — 聊天插件 SDK](#7-lobehubchat-plugin-sdk--聊天插件-sdk)
- [8. @lobehub/market-sdk — Agent 市场 SDK](#8-lobehubmarket-sdk--agent-市场-sdk)
- [9. 集成优先级与路线图](#9-集成优先级与路线图)
- [10. 完整依赖清单](#10-完整依赖清单)

---

## 0. 调研总览与结论

### 0.1 八个包调研结论

| # | 包名 | 版本 | 用途 | 决策 | 集成阶段 |
|:---:|------|------|------|:---:|:---:|
| 1 | **@lobehub/ui** | 5.10.1 | Chat UI + Markdown + 基础组件 + Layout + base-ui | ✅ **核心接入** | Phase 0 |
| 2 | **@lobehub/icons** | 1.29.0 | AI/LLM 品牌图标 | ✅ **接入** | Phase 0 |
| 3 | **@lobehub/charts** | 2.0.0 | 统计图表 (基于 Recharts) | ✅ **接入** | Phase 3 |
| 4 | **@lobehub/editor** | latest | AI 交互输入编辑器 (基于 Lexical) | ✅ **核心接入** | Phase 1 |
| 5 | **@lobehub/tts** | 1.23.4 | TTS/STT 语音能力 | ⚠️ **远期** | Phase 4+ |
| 6 | **@lobehub/lint** | 1.24.4 | ESLint + Prettier 配置 | ✅ **接入** | Phase 0 |
| 7 | **@lobehub/chat-plugin-sdk** | 1.32.4 | 聊天插件开发 SDK | ⚠️ **参考** | Phase 2+ |
| 8 | **@lobehub/market-sdk** | 0.9.0 | Agent 市场集成 | ⚠️ **远期** | v1.0+ |

### 0.2 关键技术关系

> **关键说明**：antd v6 + antd-style 仅作为 @lobehub/ui 的底层依赖存在，**禁止直接使用其原生组件 API**。

```
@lobehub/ui (核心 UI)  ←── 依赖 ──→  antd v6 + antd-style (仅作底层依赖，禁止直接使用)
       │
       ├── /base-ui 子包 → 无头原语 (Headless Primitives) — 优先使用
       ├── /layout 子包  → Layout/LayoutHeader/LayoutMain/LayoutSidebar/LayoutToc
       ├── /chat 子包    → ChatItem, ChatList, TokenTag, LoadingDots, ChatHeader
       ├── /mdx 子包     → Markdown 渲染 + LaTeX + 代码高亮
       ├── /base 子包    → ActionIcon, Avatar, Icon, Tooltip 等基础组件
       └── /charts 子包  → (独立包 @lobehub/charts)

@lobehub/icons → 静态 SVG/PNG/WebP，模型品牌图标
@lobehub/lint  → ESLint + Prettier + Stylelint 统一配置
@lobehub/tts   → Edge/OpenAI TTS + OpenAI Whisper STT
@lobehub/editor → Lexical 富文本，AI 交互输入编辑器
```

### 0.3 双编辑器架构

> **关键决策**：参考 [08 文档 §3.3 D3.1](./08-技术选型与架构方案(实施版).md)，本项目采用「双编辑器架构」——**Monaco (代码编辑) + @lobehub/editor (AI 交互输入)**，职责严格分离。

| 维度 | Monaco Editor | @lobehub/editor |
|------|---------------|-----------------|
| **定位** | 代码编辑器 (Code Editor) | AI 交互输入编辑器 (Prompt Editor) |
| **底层** | Monaco (VS Code 同款) | Meta Lexical (Facebook 开源) |
| **适用场景** | 文件编辑、代码补全、Diff 查看 | 对话输入框、/命令、@提及、附件、富文本 Prompt |
| **核心能力** | 多语言语法高亮、LSP、多光标、折叠 | 富文本 (Bold/Italic/Code)、指令芯片、文件提及、附件预览 |
| **集成位置** | 右侧面板「资源管理器」打开文件时 / Diff 视图 | 中间主交互区底部输入框 |
| **包名** | `@monaco-editor/react` + `monaco-editor` | `@lobehub/editor` |
| **主题同步** | 四色同步之一 (syncMonacoTheme) | 四色同步之一 (syncLobeEditorTheme) |

```
┌─────────────────────────────────────────────────────────────┐
│                    双编辑器职责分工                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [中间主交互区]              [右侧功能面板]                  │
│  ┌─────────────────┐         ┌─────────────────┐            │
│  │  AI 对话消息流   │         │  资源管理器      │            │
│  │  (ChatList)     │         │  ┌───────────┐  │            │
│  │                 │         │  │ 文件树     │  │            │
│  ├─────────────────┤         │  └───────────┘  │            │
│  │ ✏️ @lobehub/    │         │  ┌───────────┐  │            │
│  │   editor        │         │  │ Monaco     │  │            │
│  │ (AI 输入编辑器) │         │  │ Editor     │  │            │
│  │ /命令 @文件 📎  │         │  │ (代码编辑) │  │            │
│  └─────────────────┘         │  └───────────┘  │            │
│                              └─────────────────┘            │
│  职责：Prompt 输入           职责：代码编辑                   │
│  - 富文本格式                - 语法高亮                       │
│  - /命令芯片                 - LSP 智能提示                   │
│  - @文件提及                 - 多光标编辑                     │
│  - 附件预览                  - Diff 视图                      │
└─────────────────────────────────────────────────────────────┘
```

---

### 0.4 UI 组件优先级策略

> **关键决策**：遵循 [LobeHub 官方 React 组件编写指南](https://www.skills.sh/lobehub/lobehub/react)，**禁止将 antd v6 + antd-style 作为首选 UI 框架**。antd v6 仅作为 @lobehub/ui 的底层依赖存在，不直接使用其原生组件 API。

#### 组件优先级（5 级降序）

| 优先级 | 来源 | 说明 | 使用场景 |
|:---:|------|------|----------|
| **P1** | `src/components` | 项目自建可复用组件 | 项目特定 UI（如 AI 状态面板、Agent 模式切换器） |
| **P2** | `@lobehub/ui/base-ui` | **无头原语 (Headless Primitives)**，优先使用 | Overlay、Form、Navigation 等基础原语 |
| **P3** | `@lobehub/ui` | 高级组件（antd 包装层） | Chat/Markdown/Layout/DraggablePanel/ActionIcon 等 |
| **P4** | `antd v6` | **仅当 @lobehub/ui 完全无法满足时**（兜底） | 复杂 Table、Tree 等 @lobehub/ui 未覆盖组件 |
| **P5** | 自定义实现 | 真正的最后手段 | 特殊定制需求 |

> **重要规则**：如果组件存在于 `@lobehub/ui/base-ui`，**禁止**导入同名的根导出（`@lobehub/ui`）或 antd 原生 API。

#### 样式方案优先级（3 级降序）

| 优先级 | 方案 | 说明 | 使用场景 |
|:---:|------|------|----------|
| **S1** | `createStaticStyles` + `cssVar.*` | **零运行时**，模块级样式（首选） | 大多数样式场景 |
| **S2** | 内联 `style` 属性 | 简单一次性样式 | 快速原型、动态值少的场景 |
| **S3** | `createStyles` + `token` (antd-style) | **最后手段**，仅用于真正动态样式 | JS 颜色函数（readableColor/chroma）等 |

> **禁止**：直接调用 `antd-style` 的 `createTheme` API。主题通过 `@lobehub/ui` 的 `ThemeProvider` 注入。

#### 主题与布局策略

| 维度 | 方案 | 说明 |
|------|------|------|
| **主题** | `@lobehub/ui` ThemeProvider | 内部封装 antd ConfigProvider，支持 Light/Dark 自动切换 |
| **布局** | `@lobehub/ui` Layout 组件体系 | LayoutHeader / LayoutMain / LayoutSidebar / LayoutToc / LayoutFooter |
| **可拖拽面板** | `@lobehub/ui` DraggablePanel | 替代 react-resizable-panels，与 LobeUI 主题一致 |
| **弹性布局** | `@lobehub/ui` Flexbox / Center / Grid | 替代手写 CSS flex/grid |
| **i18n** | `@lobehub/ui` I18nProvider | 内置多语言支持 |

#### antd v6 + antd-style 定位变更

| 维度 | v1.1 (旧) | v1.2 (新) |
|------|-----------|-----------|
| **antd v6** | 核心 UI 框架（与 @lobehub/ui 并列） | **兜底依赖**（仅当 @lobehub/ui 无法满足时） |
| **antd-style** | 核心 CSS-in-JS 方案 | **最后手段**（仅用于真正动态样式） |
| **ThemeProvider** | 直接调用 antd-style createTheme | 通过 @lobehub/ui ThemeProvider 间接使用 |
| **Layout** | react-resizable-panels + 自建 | @lobehub/ui Layout + DraggablePanel |

---

## 1. @lobehub/ui — 核心 UI 组件库

### 1.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/ui` |
| **版本** | 5.10.1 (2026-05-06) |
| **许可证** | MIT ✅ |
| **基础框架** | React + Ant Design |
| **样式方案** | antd-style (CSS-in-JS) |
| **包结构** | ESM only，支持 Tree-shaking |
| **月下载量** | 10 万+ |

### 1.2 子包结构

```
@lobehub/ui
├── /base-ui    → 无头原语 (Headless Primitives) — 优先使用
│                 Overlay、Form、Navigation、Combobox、Slider、Toast 等
├── /chat       → ChatItem, ChatList, TokenTag, LoadingDots, ChatHeader
├── /mdx        → Markdown 渲染 (支持 LaTeX 数学公式 + 语法高亮)
├── /base       → ActionIcon, Avatar, Icon, Tooltip, 等基础组件
├── /layout     → Layout/LayoutHeader/LayoutMain/LayoutSidebar/LayoutToc/LayoutFooter
├── /theme      → 主题 token 导出
└── /charts     → (已独立为 @lobehub/charts)
```

### 1.2.1 base-ui 无头原语子包

> **关键说明**：`@lobehub/ui/base-ui` 是 LobeHub 官方推荐的**无头原语子包**，提供完全可访问性 (a11y) 的基础原语，与 antd 解耦，样式由消费方注入。

| 原语类别 | 组件 | 替代 antd 原生 |
|----------|------|----------------|
| **Overlay** | Dialog、Popover、Tooltip、Toast、Alert | antd Modal/Popover/Tooltip |
| **Form** | Input、Textarea、Checkbox、Radio、Switch、Select | antd Form 控件 |
| **Navigation** | Tabs、Breadcrumb、Pagination | antd Tabs/Breadcrumb/Pagination |
| **Combobox** | Combobox、Autocomplete | antd AutoComplete |
| **Slider** | Slider、RangeSlider | antd Slider |
| **Toast** | ToastProvider、useToast | antd message/notification |

**使用规则**：若组件存在于 `@lobehub/ui/base-ui`，**禁止**导入 `@lobehub/ui` 根导出或 antd 原生 API。

```typescript
// ✅ 正确：优先使用 base-ui 无头原语
import { Dialog } from '@lobehub/ui/base-ui';

// ❌ 禁止：直接使用 antd Modal
import { Modal } from 'antd';
```

### 1.2.2 Layout 组件体系

> **关键说明**：`@lobehub/ui` Layout 组件体系替代原 `react-resizable-panels`，提供与 LobeUI 主题完全一致的布局组件。

| 组件 | 用途 | 项目应用场景 |
|------|------|--------------|
| `Layout` | 布局容器（根） | 三栏 AI IDE 布局根容器 |
| `LayoutHeader` | 顶部窗口栏 | 头部窗口栏（Logo + 左侧栏切换 + 模型选择 + 工具栏） |
| `LayoutSidebar` | 左侧导航栏 | 会话历史 + 智能体列表 + 新建按钮 |
| `LayoutMain` | 主内容区 | 中间 AI 交互区（消息流 + 输入编辑器） |
| `LayoutToc` | 右侧附加面板 | 右侧功能面板（资源管理器 + Monaco + 终端 + Diff） |
| `LayoutFooter` | 底部状态栏 | 底部状态栏（运行状态 + 模型 + Token + Agent 模式） |

```typescript
import { Layout, LayoutHeader, LayoutSidebar, LayoutMain, LayoutToc, LayoutFooter } from '@lobehub/ui/layout';

export default function AppShell() {
  return (
    <Layout>
      <LayoutHeader>头部窗口栏</LayoutHeader>
      <Layout>
        <LayoutSidebar>左侧导航</LayoutSidebar>
        <LayoutMain>中间 AI 交互区</LayoutMain>
        <LayoutToc>右侧功能面板</LayoutToc>
      </Layout>
      <LayoutFooter>底部状态栏</LayoutFooter>
    </Layout>
  );
}
```

### 1.3 核心 Chat 组件 API

#### ChatItem — 单条消息组件

```typescript
import { ChatItem } from '@lobehub/ui/chat';

interface ChatItemProps {
  avatarMeta: MetaData;           // 必填：头像元数据
  message?: ReactNode;            // 消息内容
  placement?: 'left' | 'right';   // 消息位置 (默认 left)
  variant?: 'bubble' | 'docs';    // 样式变体
  loading?: boolean;              // 加载状态
  editing?: boolean;              // 编辑模式
  actions?: ReactNode;            // 操作按钮 (ActionIconGroup)
  error?: AlertProps;             // 错误配置
  time?: number;                  // 时间戳
}
```

#### ChatList — 消息列表组件

```typescript
import { ChatList } from '@lobehub/ui/chat';

// 数据源格式
interface ChatMessage {
  id: string;
  content: ReactNode;
  role: 'user' | 'assistant' | 'system';
  placement?: 'left' | 'right';
  loading?: boolean;
  error?: AlertProps;
  time?: number;
  actions?: ReactNode;
  avatarMeta?: MetaData;
}
```

#### TokenTag — Token 使用量指示器

```typescript
import { TokenTag } from '@lobehub/ui/chat';

interface TokenTagProps {
  value: number;      // 当前使用量
  maxValue: number;   // 最大限制
}

// 颜色自动计算：
// < 70%: 正常色
// < 90%: 警告色
// ≥ 90%: 错误色
```

### 1.4 在我们的项目中的应用

| 组件 | 应用场景 | 优先级 |
|------|----------|:---:|
| **ChatItem** | 对话面板中的每条消息 | P0 |
| **ChatList** | 消息列表渲染 (虚拟滚动) | P0 |
| **ChatHeader** | 对话面板顶部标题栏 | P0 |
| **TokenTag** | 显示 Token 消耗和上下文余量 | P0 |
| **LoadingDots** | AI 正在思考/生成的加载动画 | P0 |
| **ActionIconGroup** | 消息操作按钮组 (复制/重试/删除) | P1 |
| **Markdown (mdx)** | AI 回复的 Markdown 渲染 | P0 |
| **基础组件 (base)** | 头像、图标、Tooltip 等 | P0 |
| **Layout 组件体系** | 三栏 AI IDE 布局 | P0 |
| **base-ui 无头原语** | Overlay/Form/Navigation 基础原语 | P0 |

### 1.5 与现有技术栈的关系

> **关键说明**：antd v6 + antd-style 仅作为 @lobehub/ui 底层依赖存在，**禁止直接使用其原生组件 API**。

```
用户技术栈                    @lobehub/ui 能力
════════════════════════════════════════════════════
React 19          ✅ 兼容 (antd v6 原生支持 React 19)
@lobehub/ui       ✅ 首选 UI 框架（base-ui + 高级组件）
antd v6           仅作 @lobehub/ui 底层依赖，禁止直接使用原生 API
antd-style        仅作 @lobehub/ui 底层依赖，禁止直接使用原生 API（禁止 createTheme）
Zustand           ✅ 状态管理层，与 UI 解耦
```

### 1.6 替换关系

> **关键说明**：以 @lobehub/ui 为主，antd v6 + antd-style 仅作为 @lobehub/ui 底层依赖存在，禁止直接使用其原生组件 API。

| 原设计 (v3.0) | 替换为 | 兜底方案 (P4) | 理由 |
|---------------|---------------------|---------------|------|
| shadcn/ui + Tailwind | **@lobehub/ui**（base-ui 优先 → 高级组件） | antd v6 | Lobe UI 提供完整 Chat/Markdown/Layout 组件，禁止 antd 作为首选 |
| react-resizable-panels | **@lobehub/ui** Layout + DraggablePanel | — | LobeHub Layout 与 LobeUI 主题一致 |
| react-markdown | **@lobehub/ui/mdx** | — | Lobe MDX 支持 LaTeX + 语法高亮 + 流式渲染 |
| lucide-react | **@lobehub/icons** + @lobehub/ui ActionIcon | @ant-design/icons | AI 品牌图标 + LobeUI 通用图标 |
| 自建 ChatItem/MessageBubble | **@lobehub/ui/chat** | — | 开箱即用，含加载/编辑/错误/操作等完整状态 |
| 自建 LoadingDots | **@lobehub/ui/chat** | — | 已实现精美加载动画 |
| CSS Modules / Tailwind | **createStaticStyles** + `cssVar.*` (S1) | antd-style (S3) | 零运行时 CSS-in-JS，模块级样式 |
| antd Modal/Popover/Tooltip | **@lobehub/ui/base-ui** (Overlay 原语) | antd (兜底) | 无头原语优先 |
| antd Form/Input/Select | **@lobehub/ui/base-ui** (Form 原语) | antd (兜底) | 无头原语优先 |
| antd Tabs/Breadcrumb | **@lobehub/ui/base-ui** (Navigation 原语) | antd (兜底) | 无头原语优先 |

---

## 2. @lobehub/icons — AI/LLM 品牌图标库

### 2.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/icons` |
| **版本** | 1.29.0 (2026-05-24) |
| **许可证** | MIT ✅ |
| **格式** | SVG / PNG / WebP |
| **覆盖** | 主流 AI/LLM 模型品牌：OpenAI, Anthropic, Google, Meta, DeepSeek, 等 |

### 2.2 使用方式

```typescript
// 按需导入
import { OpenAIIcon, ClaudeIcon, GeminiIcon, DeepSeekIcon } from '@lobehub/icons';

// 或通过 CDN
// https://unpkg.com/@lobehub/icons@1.29.0/assets/openai.svg
```

### 2.3 在我们的项目中的应用

| 场景 | 使用方式 |
|------|----------|
| **模型选择器** | 每个 Provider/Model 旁显示对应品牌图标 |
| **Provider 配置面板** | 区分不同 AI 服务商 |
| **消息头像** | ChatItem 的 avatarMeta 中使用 |
| **关于页面** | 展示支持的模型品牌 |

---

## 3. @lobehub/charts — 图表组件库

### 3.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/charts` |
| **版本** | 2.0.0 |
| **许可证** | MIT ✅ |
| **基础库** | Recharts (基于 D3) |
| **组件** | AreaChart, BarChart, DonutChart, Heatmap, FunnelChart 等 |

### 3.2 在我们的项目中的应用

| 场景 | 图表类型 | 集成阶段 |
|------|----------|:---:|
| **成本分析面板** | AreaChart (日/周/月费用趋势) | Phase 3 |
| **Token 用量统计** | BarChart (按模型/会话) | Phase 3 |
| **Agent 活跃度** | DonutChart (工具调用分布) | Phase 3 |
| **审计仪表盘** | Heatmap (权限审批热度) | v1.0+ |

> **决策**：Phase 3 集成。MVP 阶段不需要图表，先聚焦核心对话 + Agent 能力。

---

## 4. @lobehub/editor — AI 交互输入编辑器

> **定位**：AI 交互面板输入编辑器。代码编辑场景由 Monaco Editor 负责，两者职责分离（参见 §0.3 双编辑器架构）。

### 4.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/editor` |
| **版本** | latest (跟随 LobeHub 生态) |
| **许可证** | MIT ✅ |
| **基础框架** | Meta Lexical (Facebook 开源) |
| **定位** | AI 交互输入编辑器 (Prompt Editor) |
| **集成位置** | 中间主交互区底部输入框 |
| **集成阶段** | Phase 1 (Week 2-3) |

### 4.2 决策：✅ 核心接入

**接入理由**：

1. **定位重新校准**：@lobehub/editor 不作为代码编辑器，而是作为 **AI 对话输入框**，与 Monaco 职责分离
2. **Lexical 优势契合 AI 输入场景**：
   - 富文本格式（Bold/Italic/Code/Link）让用户编写结构化 Prompt
   - 节点级 DOM 支持嵌入式「指令芯片」（/命令、@文件提及、#智能体引用）
   - 附件预览节点（图片/文件卡片）直接渲染在输入流中
3. **与 @lobehub/ui 同源**：主题 token、样式方案、设计语言完全一致，无需额外对齐
4. **覆盖 08 实施版 §11.3.2 输入区设计需求**：/命令、@文件提及、附件、模型切换、模式切换全部由 @lobehub/editor 承载

**结论**：核心接入，作为 AI 交互面板的输入编辑器，Phase 1 集成。

### 4.3 核心能力与项目需求映射

| @lobehub/editor 能力 | 项目场景 | 优先级 |
|----------------------|----------|:---:|
| **富文本格式** (Bold/Italic/Code/Link) | 用户编写结构化 Prompt（强调重点、嵌入代码片段） | P0 |
| **指令芯片节点** (Custom Node) | `/命令` 渲染为不可编辑的芯片（如 `/plan`、`/review`） | P0 |
| **文件提及节点** (Custom Node) | `@文件路径` 渲染为带图标的文件卡片，点击可移除 | P0 |
| **智能体引用节点** (Custom Node) | `#智能体名` 渲染为 Agent 标签 | P1 |
| **附件预览节点** (Custom Node) | 拖拽/粘贴的图片、文件渲染为缩略图卡片 | P0 |
| **Markdown 快捷输入** | 输入 `# ` 自动转 H1、`- ` 自动转列表、` ``` ` 自动转代码块 | P1 |
| **历史记录** (History) | Ctrl+Z/Y 撤销重做 | P0 |
| **协同光标** (Collaboration) | 远期 Sub-Agent 协作输入（Phase 4+） | P2 |

### 4.4 API 集成示例

```typescript
import { LobeEditor, type LobeEditorProps } from '@lobehub/editor';

// 自定义节点注册
import { CommandChipNode } from './nodes/CommandChipNode';
import { FileMentionNode } from './nodes/FileMentionNode';
import { AgentRefNode } from './nodes/AgentRefNode';
import { AttachmentNode } from './nodes/AttachmentNode';

const props: LobeEditorProps = {
  placeholder: '输入消息，/ 触发命令，@ 引用文件，# 引用智能体…',
  theme: 'dark',                          // 由 syncLobeEditorTheme 同步
  nodes: [CommandChipNode, FileMentionNode, AgentRefNode, AttachmentNode],
  onChange: (markdown: string) => {
    // 输出 Markdown 字符串发送给 LLM
  },
  onSubmit: (markdown: string) => {
    // Enter 发送 / Shift+Enter 换行
  },
  attachments: {
    onPaste: handlePasteImage,
    onDrop: handleDropFile,
  },
  slashCommands: {
    trigger: '/',
    commands: getSlashCommands,           // 返回 /plan /review /clear …
  },
  fileMentions: {
    trigger: '@',
    resolver: resolveFilePath,            // 文件路径补全
  },
  agentRefs: {
    trigger: '#',
    resolver: resolveAgent,               // 智能体补全
  },
};

return <LobeEditor {...props} />;
```

### 4.5 与 Monaco Editor 的职责边界

```
┌──────────────────────────────────────────────────────────┐
│              双编辑器职责严格分离                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  @lobehub/editor (Phase 1)        Monaco Editor (Phase 0)│
│  ─────────────────────────        ──────────────────────  │
│  ✅ AI 对话输入框                  ✅ 文件代码编辑          │
│  ✅ /命令芯片                      ✅ Diff 查看            │
│  ✅ @文件提及                      ✅ 多光标               │
│  ✅ 附件预览                       ✅ LSP 智能提示          │
│  ✅ 富文本 Prompt                  ✅ 语法高亮              │
│  ❌ 代码编辑                       ❌ 富文本/指令芯片       │
│  ❌ LSP/Diff                       ❌ 对话输入             │
│                                                          │
│  通信：@lobehub/editor 通过 @提及引用 Monaco 打开的文件    │
└──────────────────────────────────────────────────────────┘
```

---

## 5. @lobehub/tts — 语音合成/识别库

### 5.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/tts` |
| **版本** | 1.23.4 (2026-05-14) |
| **许可证** | MIT ✅ |
| **月下载量** | 13 万+ |

### 5.2 核心能力

| 类 | 功能 | 底层服务 |
|----|------|----------|
| **EdgeSpeechTTS** | 文本转语音 | 微软 Edge 语音合成 (WebSocket) |
| **MicrosoftSpeechTTS** | 文本转语音 | Azure 认知服务 |
| **OpenAITTS** | 文本转语音 | OpenAI TTS API (alloy/echo/fable/onyx/nova/shimmer) |
| **OpenaiSTT** | 语音转文本 | OpenAI Whisper API |

### 5.3 API 示例

```typescript
import { OpenAITTS } from '@lobehub/tts';

const tts = new OpenAITTS({
  OPENAI_API_KEY: 'sk-xxx',
  OPENAI_PROXY_URL: 'https://api.openai.com/v1',
});

// 生成音频
const audioBuffer = await tts.createAudio({
  text: 'Hello, this is a test.',
  options: {
    model: 'tts-1',
    voice: 'alloy',
    speed: 1.0,
  },
});
```

### 5.4 决策：⚠️ 远期集成 (Phase 4+)

**理由**：

1. **非核心功能**：AI IDE 的核心是代码编辑 + Agent 协作，语音输入/输出属于锦上添花
2. **MVP 聚焦**：优先实现核心对话 + Agent 能力
3. **功能场景明确**：
   - 语音输入：用户口述需求，Agent 执行 (Phase 4)
   - 语音输出：Agent 朗读代码分析结果 (Phase 4)

---

## 6. @lobehub/lint — 代码规范工具集

### 6.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/lint` |
| **版本** | 1.24.4 (2026-03-21) |
| **许可证** | MIT ✅ |
| **集成** | ESLint + Prettier + Stylelint + Commitlint + Remarklint |

### 6.2 决策：✅ 直接接入

**理由**：

1. **开箱即用**：一个包搞定所有代码规范配置
2. **与 @lobehub/ui 一致**：LobeHub 项目使用的就是这套规范，风格统一
3. **支持自动检测**：安装时自动检测项目配置 (包管理器、TypeScript、React 框架)
4. **减少配置工作**：不需要手动配置 ESLint + Prettier 规则

### 6.3 使用方式

```bash
# 安装
npm install -D @lobehub/lint

# 自动配置 (交互式)
npx @lobehub/lint setup
```

### 6.4 配置文件示例

```javascript
// eslint.config.mjs
import { defineConfig } from '@lobehub/lint';

export default defineConfig({
  // 自动检测 TypeScript + React
  typescript: true,
  react: true,
});
```

---

## 7. @lobehub/chat-plugin-sdk — 聊天插件 SDK

### 7.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/chat-plugin-sdk` |
| **版本** | 1.32.4 (2025-01-07) |
| **许可证** | MIT ✅ |
| **用途** | LobeChat 插件开发标准 SDK |

### 7.2 决策：⚠️ 参考架构，不直接接入

**理由**：

1. **LobeChat 专属**：该 SDK 是 LobeChat 的插件协议，与我们的 AI IDE 架构不完全兼容
2. **协议不匹配**：我们有自己的 MCP + Plugin SDK 设计，不需要引入另一套插件协议
3. **参考价值**：
   - 插件 Manifest 结构设计
   - Function Calling 声明方式
   - 插件通信模式 (Client SDK ↔ Plugin)

### 7.3 可参考的设计模式

```
LobeChat Plugin SDK 的插件 Manifest 结构:

plugin.json {
  "identifier": "plugin-id",
  "version": "1.0.0",
  "api": [
    {
      "name": "functionName",
      "description": "...",
      "parameters": { JSON Schema },
    }
  ],
  "ui": {
    "url": "https://...",
    "height": 400,
  }
}

 我们的 Plugin SDK 可参考此结构设计 manifest
```

---

## 8. @lobehub/market-sdk — Agent 市场 SDK

### 8.1 基本信息

| 属性 | 值 |
|------|-----|
| **npm** | `@lobehub/market-sdk` |
| **版本** | 0.9.0 (2025-06-21) |
| **许可证** | MIT ✅ |
| **用途** | LobeHub Agent 市场 API 客户端 |

### 8.2 决策：⚠️ 远期参考 (v1.0+)

**理由**：

1. **版本早期**：0.9.0，API 可能不稳定
2. **LobeHub 专属**：依赖 LobeHub 的 Agent 市场 API
3. **MVP 不需要**：先构建核心 Agent 能力，Agent 市场是 v1.0+ 的功能
4. **未来价值**：
   - 可集成 LobeHub Agent 市场的公开 Agent
   - 作为我们自己的 Agent 商店的参考设计

---

## 9. 集成优先级与路线图

### 9.1 集成阶段总览

```
Phase 0 (Week 1): 基础框架搭建
├── ✅ @lobehub/ui        → 核心 UI 组件 (ChatItem/ChatList/Markdown/Layout/base-ui)
├── ✅ @lobehub/icons      → AI 品牌图标 (模型选择器)
├── ✅ @lobehub/lint       → 代码规范配置
└── ⚠️ antd v6 + antd-style → 仅作 @lobehub/ui 底层依赖（禁止直接使用原生 API）

Phase 1 (Week 2-3): 对话功能
├── ✅ @lobehub/ui/chat   → ChatItem 消息气泡 + ChatList 列表
├── ✅ @lobehub/ui/mdx    → AI 回复 Markdown 渲染
├── ✅ @lobehub/icons      → Provider 模型图标
└── ✅ @lobehub/editor     → AI 交互输入编辑器 (/命令 + @文件 + 附件)

Phase 2 (Week 4-5): Agent 引擎
├── ✅ @lobehub/ui/chat   → TokenTag + LoadingDots
├── ✅ @lobehub/ui/base   → ActionIconGroup 操作按钮组
└── ⚠️ chat-plugin-sdk    → 参考插件 Manifest 设计

Phase 3 (Week 6-7): 数据面板
├── ✅ @lobehub/charts     → 成本分析图表
└── ✅ @lobehub/charts     → Token 用量统计

Phase 4+ (v0.3+): 增强体验
├── ⚠️ @lobehub/tts        → 语音输入/输出
└── ⚠️ @lobehub/market-sdk → Agent 市场 (v1.0+)
```

### 9.2 决策矩阵

| 包 | 决策 | 理由 |
|----|:---:|------|
| @lobehub/ui | ✅ 核心接入 | Chat/Markdown/Layout/base-ui 组件开箱即用，**首选 UI 框架** |
| @lobehub/icons | ✅ 接入 | 模型品牌图标，零成本提升体验 |
| @lobehub/charts | ✅ 接入 | Phase 3 数据面板，基于 Recharts 成熟稳定 |
| @lobehub/editor | ✅ 核心接入 | AI 交互输入编辑器，富文本 + 指令芯片 + 附件 |
| @lobehub/tts | ⚠️ 远期 | 非 MVP 核心功能，Phase 4+ 再评估 |
| @lobehub/lint | ✅ 接入 | 开箱即用代码规范，与 Lobe UI 风格一致 |
| @lobehub/chat-plugin-sdk | ⚠️ 参考 | LobeChat 专属协议，参考其设计模式 |
| @lobehub/market-sdk | ⚠️ 远期 | 版本早期，v1.0+ 再评估 |
| antd v6 + antd-style | ⚠️ 底层依赖 | @lobehub/ui 底层依赖，**禁止直接使用原生 API**，仅当 @lobehub/ui 无法满足时作为兜底 |

---

## 10. 完整依赖清单

### 10.1 Phase 0 核心依赖

> **说明**：antd / antd-style 标注为「**底层依赖**」，禁止直接使用其原生组件 API；react-resizable-panels 已由 @lobehub/ui Layout 替代，从依赖清单中移除。

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",

    "// === LobeHub UI 主框架（首选）===": "",
    "@lobehub/ui": "^5.10.1",
    "@lobehub/icons": "^1.29.0",
    "@lobehub/editor": "^1.0.0",

    "// === 兜底依赖（仅 @lobehub/ui 无法满足时使用）===": "",
    "antd": "^6.4.0",
    "antd-style": "^4.1.0",

    "// === 编辑器与终端（独立子系统）===": "",
    "@monaco-editor/react": "^4.7.0",
    "monaco-editor": "^0.55.0",
    "xterm": "^5.3.0",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/addon-search": "^0.15.0",

    "// === 工具库 ===": "",
    "zustand": "^5.0.0",
    "zod": "^3.23.0",
    "dayjs": "^1.11.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^35.0.0",
    "electron-vite": "^5.0.0",
    "electron-builder": "^25.0.0",
    "@lobehub/lint": "^1.24.0",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "playwright": "^1.50.0"
  }
}
```

> **依赖说明**：
> - **首选 UI 框架**：`@lobehub/ui`（含 base-ui 子包、Layout 组件体系、Chat/MDX 等高级组件）
> - **antd v6 + antd-style**：作为 `@lobehub/ui` 的底层依赖存在；**禁止**直接使用 antd 原生 API 和 antd-style `createTheme`，仅在 `@lobehub/ui` 完全无法覆盖（如复杂 Table/Tree）时作为兜底
> - **react-resizable-panels**：已移除，由 `@lobehub/ui` Layout + DraggablePanel 替代

### 10.2 Phase 3 新增依赖

```json
{
  "dependencies": {
    "@lobehub/charts": "^2.0.0"
  }
}
```

### 10.3 Phase 4+ 备选依赖

```json
{
  "dependencies": {
    "@lobehub/tts": "^1.23.0",
    "@lobehub/market-sdk": "^0.9.0"
  }
}
```

---

## 附录 A: 与原设计文档的变更对照

| 原设计 (v3.0 实施版) | 新方案 (LobeHub 集成) | 变更原因 |
|----------------------|----------------------|----------|
| shadcn/ui + Tailwind CSS | **@lobehub/ui**（base-ui 优先 → 高级组件） | Lobe UI 提供完整 Chat/Markdown/Layout 组件，禁止 antd 作为首选 |
| react-resizable-panels | **@lobehub/ui** Layout + DraggablePanel | LobeHub Layout 与 LobeUI 主题一致 |
| react-markdown | **@lobehub/ui/mdx** | 支持 LaTeX + 语法高亮 + 流式渲染 |
| lucide-react | **@lobehub/icons** + @lobehub/ui ActionIcon | AI 品牌图标 + LobeUI 通用图标 |
| 自建 ChatItem/MessageBubble | **@lobehub/ui/chat** | 开箱即用，含完整状态处理 |
| 自建 LoadingDots | **@lobehub/ui/chat** | 已实现精美加载动画 |
| ESLint + Prettier 手动配置 | **@lobehub/lint** | 统一配置，开箱即用 |
| 自建图表组件 | **@lobehub/charts** | 基于 Recharts，组件丰富 |
| 自建 AI 输入框 | **@lobehub/editor** | 富文本 + 指令芯片 + 附件，与 @lobehub/ui 同源 |
| CodeMirror 6 | **Monaco Editor** (保持不变) | 用户指定，IDE 级编辑器 |
| Tailwind CSS | **createStaticStyles** + `cssVar.*` (S1) → antd-style (S3 兜底) | 全局主题统一 (UI + Monaco + LobeEditor + 终端四色同步) |
| antd Modal/Form/Tabs 原生 | **@lobehub/ui/base-ui** 无头原语 | 禁止 antd 作为首选，无头原语优先 |

---

## 附录 B: 主题系统设计

### B.1 四色同步架构

> **关键决策**：采用「四色同步」(UI + Monaco + **LobeEditor** + 终端)，覆盖 @lobehub/editor 主题同步。UI 层主题通过 `@lobehub/ui` ThemeProvider 注入，**禁止**直接调用 `antd-style` `createTheme` API。

```typescript
// 通过 @lobehub/ui ThemeProvider 注入主题（推荐方式）
import { ThemeProvider } from '@lobehub/ui';

// 主题 token
const themeTokens = {
  // UI 层 (antd + @lobehub/ui)
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    borderRadius: 6,
  },
};

export default function App() {
  return (
    <ThemeProvider theme={themeTokens}>
      <AppShell />
    </ThemeProvider>
  );
}

// Monaco Editor 主题同步 (色 2)
function syncMonacoTheme(antdTokens: ThemeToken) {
  monaco.editor.defineTheme('openwork-theme', {
    base: 'vs-dark',
    inherit: true,
    colors: {
      'editor.background': antdTokens.colorBgContainer,
      'editor.foreground': antdTokens.colorText,
    },
    rules: [/* ... */],
  });
}

// @lobehub/editor 主题同步 (色 3)
function syncLobeEditorTheme(antdTokens: ThemeToken) {
  // @lobehub/editor 基于 Lexical，通过 ThemeProvider 注入
  // 与 antd-style token 保持一致
  const lobeEditorTheme = {
    primary: antdTokens.colorPrimary,
    success: antdTokens.colorSuccess,
    warning: antdTokens.colorWarning,
    error: antdTokens.colorError,
    background: antdTokens.colorBgContainer,
    foreground: antdTokens.colorText,
    borderRadius: antdTokens.borderRadius,
    fontFamily: antdTokens.fontFamily,
    // 自定义节点样式（指令芯片、文件提及、附件卡片）
    chip: {
      background: antdTokens.colorFillSecondary,
      border: antdTokens.colorBorder,
      text: antdTokens.colorText,
    },
  };
  // 注入到 LobeEditor 的 theme prop
  return lobeEditorTheme;
}

// xterm.js 终端主题同步 (色 4)
function syncTerminalTheme(antdTokens: ThemeToken) {
  const terminalTheme: ITheme = {
    background: antdTokens.colorBgElevated,
    foreground: antdTokens.colorText,
    cursor: antdTokens.colorPrimary,
    // ...
  };
}
```

### B.2 四色同步覆盖范围

| # | 色彩层 | 覆盖组件 | 同步函数 | 状态 |
|:---:|:---:|----------|----------|:---:|
| 1 | UI 层 | @lobehub/ui (Chat/Markdown/Layout/base-ui) + antd v6 兜底 | @lobehub/ui ThemeProvider | ✅ |
| 2 | Monaco 层 | @monaco-editor/react (代码编辑/Diff) | syncMonacoTheme | ✅ |
| 3 | LobeEditor 层 | @lobehub/editor (AI 输入/指令芯片/附件) | syncLobeEditorTheme | ✅ |
| 4 | 终端层 | xterm.js (终端输出) | syncTerminalTheme | ✅ |

---

> **下一步**：基于此方案更新技术选型文档和实施版方案，然后开始 Phase 0 项目初始化。
