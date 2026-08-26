# OpenWork Agent Desktop — 完整产品设计文档

> **文档版本**: v1.4 (UI 栈重置 + CS 分离深化 + DDD 持久化 + 四能力域同步)
> **文档类型**: 产品需求 + 技术架构 + 工程实现规格 (PRD + TRD 合订)
> **审视视角**: 产品经理 (PM) / 技术总监 (CTO) / 项目总监 (PMO)
> **参考对标**: OpenCode Desktop / Claude Code / Codex CLI / Cursor / Cline / Aider
> **开源协议**: MIT
>
> **v1.4 变更说明 (UI 栈重置 + CS 分离深化 + DDD 持久化 + 四能力域同步)**:
> - **UI 栈重置**: 全面**退役** LobeHub 生态 (文档 09 已删除，原 v1.1/v1.2 的 LobeHub UI 优先级策略失效)；改用 **Ant Design v5 + Tailwind CSS v4** 双轨；AI 输入编辑器改用 **TipTap v2 + ProseMirror** (替代 @lobehub/editor)；Markdown 改用 react-markdown + rehype/remark；可拖拽面板改用 react-resizable-panels 2.1；设计决策 D9.3 重置 (见 §9.x)。详见 05 v4.3 §4/§6、08 v3.8 §3.2/§3.3、04 v4.3 §5。
> - **CS 分离深化**: 确立 OpenCode-style 客户端-服务端分离为**主架构**。v0.1 **仅交付 Desktop 客户端** (Embedded 模式 + Electron IPC Transport)，但服务契约 (§9.3)、Transport 抽象、Client SDK 已为后续 TUI/Web/CLI 接入预留扩展点。客户端扩展性通过 `@openwork/api` 公开契约保证。
> - **DDD 持久化**: §5 持久化能力明确所有数据库接口/查询/操作经 **DDD Repository 接口隔离层** (domain 接口 / infra SQLite 实现 + Drizzle ORM 查询构造)，业务层零 SQL 耦合；可替换为 Remote/Postgres 实现而业务层零修改。详见 04 v4.3 §11.9、05 v4.3 §22、06 v4.3 §2.8。
> - **四能力域同步**: 与 01 v2.4 / 02 v2.4 同步新增 SCHED (定时任务 v0.4) / GOAL (目标管理 v0.3) / PROMPT (提示词管理 v0.2+) / PROVIDER (Provider 抽象接入 v0.1+5/v0.3+SDK) 四个能力模块的 TRD 概述 (见 §3 / §4 / §5 / §6 增补小节)。
> - **开源协议统一 MIT** (修正原 Apache-2.0)。
> - **附录 C 数据模型**: 06 文档由 29 表调整为 **20 表** (与 01 §4.5.1 / 02 §3.5 / 04 §16.10 一致)；v0.1 落地 12 表 (vs v4.3 全景 20 表)。
>
> **v1.3 变更说明** (历史): 对齐 v4.2 架构，更新产品形态为多客户端分阶段交付（M19 修复）。§1.4 竞品对标表"形态"行由"原生桌面 + CLI 双形态"改为"原生桌面 (v0.1) + TUI/Web/CLI (v0.2+)"，对齐 4 客户端架构与"收缩 v0.1 范围"策略（v0.1 = Desktop 嵌入式 + 4 模块 + 12 表，TUI/Web/CLI 推迟到 v0.2+）。v1.4 已将 UI 与持久化层重置，v1.3 的多客户端分阶段策略保留。

---

## 目录

- [0. 文档阅读指南](#0-文档阅读指南)
- [1. 产品概述](#1-产品概述)
- [2. 整体架构设计](#2-整体架构设计)
- [3. 核心 Coding Agent 能力](#3-核心-coding-agent-能力)
  - [3.1 提示词系统 (Prompt Engineering System)](#31-提示词系统-prompt-engineering-system)
  - [3.2 上下文工程 (Context Engineering)](#32-上下文工程-context-engineering)
  - [3.3 Harness 工程 (Agent Harness Engineering)](#33-harness-工程-agent-harness-engineering)
  - [3.4 Loop 工程 (Agent Loop Engineering)](#34-loop-工程-agent-loop-engineering)
- [4. 扩展能力 (Extensibility)](#4-扩展能力-extensibility)
- [5. 持久化能力 (Persistence)](#5-持久化能力-persistence)
- [6. 可迁移能力 (Portability & Migration)](#6-可迁移能力-portability--migration)
- [7. 高度自定义可配置化 (Customization & Configurability)](#7-高度自定义可配置化-customization--configurability)
- [8. 其他功能需求 (Other Features)](#8-其他功能需求-other-features)
- [9. 技术架构与工程实现](#9-技术架构与工程实现)
- [10. 多轮审视与迭代记录](#10-多轮审视与迭代记录)
- [11. 里程碑与交付路线](#11-里程碑与交付路线)
- [附录 A: 术语表](#附录-a-术语表)
- [附录 B: 默认配置清单](#附录-b-默认配置清单)
- [附录 C: 数据模型草案](#附录-c-数据模型草案)

---

## 0. 文档阅读指南

本文档采用「自顶向下 + 多视角审视」结构:

| 章节 | 主要读者 | 目的 |
|------|----------|------|
| §1–§2 | PM / PMO | 理解产品定位与整体形态 |
| §3–§8 | CTO / 架构师 / 资深研发 | 落地核心能力与扩展面 |
| §9 | 全体研发 | 技术栈与工程实现约定 |
| §10 | PMO / 评审委员会 | 设计决策留痕,追溯迭代理由 |

每一核心能力章节统一遵循四段式:
**① 能力定义 → ② 子能力拆解 → ③ 关键设计决策 → ④ 配置项与默认值**

---

## 1. 产品概述

### 1.1 产品定位

OpenWork Agent Desktop 是一款**开源、本地优先 (local-first)、高度可配置**的 Coding Agent 桌面端应用。它将「LLM 推理 + 工具执行 + 代码库感知 + 工作流编排」封装为一个可交互、可中断、可审计的智能体 (Agent),面向开发者的真实编码场景。

核心命题:
- **不是**一个 Chat 框 + 代码补全;**而是**一个具备规划、执行、验证、反思闭环的自主编码智能体。
- **不锁定**任何模型供应商;**而是**提供统一抽象,允许用户接入任意 OpenAI 兼容 / Anthropic / 本地 (Ollama / llama.cpp) / 自托管模型。
- **不绑定**云端;**而是**本地优先存储,可选云同步,所有数据可导出、可迁移。

### 1.2 目标用户

| 用户画像 | 占比预估 | 核心诉求 |
|----------|----------|----------|
| 全栈独立开发者 | 40% | 一体化编码助手,降低上下文切换成本 |
| 企业研发团队 | 30% | 团队配置共享、私有模型接入、审计合规 |
| 开源贡献者 / 插件作者 | 15% | 可扩展的插件 / MCP / Skills 生态 |
| AI 安全 / Agent 研究者 | 10% | 可观测、可复现、可对照实验的 Agent harness |
| 教学 / 学习者 | 5% | 低门槛上手,直观理解 Agent 行为 |

### 1.3 核心价值主张

1. **Agent 原生**: 内置完整的 Plan-Act-Observe-Reflect 循环,而非简单工具调用封装。
2. **Harness 透明**: 提示词、上下文、工具调用、Loop 状态全链路可观测、可调试、可版本化。
3. **配置即产品**: 几乎所有行为可通过声明式配置 (YAML/JSON/TOML) 与脚本 (TS/Python) 改写。
4. **生态开放**: 一等公民支持 MCP、自定义工具、Sub-Agent、Skills、Hooks,与现有 Coding Agent 生态互通。
5. **数据主权**: 本地优先,端到端可导出,团队配置可版本化沉淀。

### 1.4 竞品对标分析

| 维度 | Claude Code | Codex CLI | OpenCode | Cursor | Cline | **本产品 (目标)** |
|------|-------------|-----------|----------|--------|-------|-------------------|
| 形态 | CLI + 桌面 | CLI | CLI/TUI | IDE | VSCode 插件 | **原生桌面 (v0.1) + TUI/Web/CLI (v0.2+)** |
| 模型绑定 | Anthropic | OpenAI | 多模型 | 多模型 | 多模型 | **多模型,可插拔** |
| 开源 | 部分 | 是 | 是 | 否 | 是 | **是** |
| 提示词可定制 | 否 | 部分 | 是 | 否 | 是 | **全链路可定制** |
| 上下文工程 | 强 | 中 | 中 | 强 (索引) | 中 | **强 (分层 + RAG + 压缩)** |
| Harness 可观测 | 中 | 低 | 中 | 低 | 中 | **强 (全链路调试器)** |
| Loop 可干预 | 中 | 低 | 中 | 低 | 中 | **强 (断点 + 子循环)** |
| MCP 支持 | 是 | 部分 | 是 | 否 | 是 | **是一等公民** |
| 插件系统 | 否 | 否 | 部分 | 否 | 否 | **是 (沙箱化)** |
| 配置迁移 | 弱 | 弱 | 中 | 弱 | 弱 | **强 (Profile + 市场)** |
| 本地优先 | 部分 | 是 | 是 | 否 | 是 | **是** |

**差异化定位**: 在 OpenCode / Cline 的开源多模型基础上,补齐「Harness 全链路可观测 + Loop 可干预 + 高度配置化 + 数据可迁移」四块短板,并引入「Profile / Skills / 插件市场」形成生态飞轮。

---

## 2. 整体架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                      表现层 (Presentation)                   │
│  桌面 UI (React/Solid) · CLI (TUI) · Web 控制台 · 通知系统    │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    应用服务层 (Application)                  │
│  会话管理 · 任务编排 · 权限仲裁 · 配置热加载 · 国际化         │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                    Agent 核心层 (Agent Core)                 │
│  Prompt Engine · Context Engine · Harness · Loop Engine     │
│  · Sub-Agent · Skills Runtime · Hooks Runtime               │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                  能力扩展层 (Capabilities)                   │
│  Tool Registry · MCP Client · Plugin Sandbox · LSP Bridge   │
│  · Editor Bridge · Terminal Bridge · Browser Bridge         │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│               模型抽象层 (Model Abstraction)                 │
│  Provider Router · Fallback · Load Balance · Cost Control   │
│  · Streaming · Function Calling · 结构化输出                 │
└─────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────┐
│                  基础设施层 (Infrastructure)                │
│  持久化 (SQLite/文件) · 索引 (向量/FTS) · 加密 · IPC · 网络  │
│  · 日志 · 遥测 · 更新                                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 进程模型

采用 **主进程 + 多 Worker 进程** 架构 (Electron):

| 进程 | 职责 | 隔离级别 |
|------|------|----------|
| Main Process | UI 渲染调度、IPC 路由、生命周期 | 主域 |
| Agent Worker | LLM 推理、Loop 执行、上下文组装 | 沙箱,无文件系统直接访问 |
| Tool Worker | 文件/终端/浏览器操作,经权限网关 | 沙箱,白名单路径 |
| Indexer Worker | 代码库索引、向量计算 | 后台,节流 |
| Plugin Worker | 第三方插件 / MCP Server 运行 | 强沙箱 (权限受限) |

> **设计决策 D2.1**: 工具执行与 LLM 推理解耦,使工具崩溃不影响 Agent 主循环;同时便于权限粒度化。

### 2.3 数据流总览

```
用户输入 / 触发器
    │
    ▼
[Application] 会话与意图解析 ──► [Context Engine] 组装上下文
    │                                       │
    │                                       ▼
    │                              [Prompt Engine] 组装 Prompt
    │                                       │
    ▼                                       ▼
[Agent Core] Loop Engine ◄══════════ [Model Abstraction] 推理
    │   ▲                                   │
    │   └──── 工具调用结果回流 ◄────────────┘
    ▼
[Capabilities] Tool/MCP/Plugin 执行 (经权限网关)
    │
    ▼
[Infrastructure] 持久化 + 索引 + 日志
    │
    ▼
[Presentation] UI 更新 / 流式输出
```

### 2.4 模块清单 (顶层)

| 模块 | 子模块 | 章节定位 |
|------|--------|----------|
| Agent Core | Prompt / Context / Harness / Loop / Sub-Agent / Skills / Hooks | §3, §4 |
| Capabilities | Tools / MCP / Plugins / Bridges (LSP/Editor/Terminal/Browser) | §4 |
| Model Abstraction | Providers / Router / Cost / Streaming | §3.3, §9 |
| Persistence | Session / Memory / Config / Index / Audit | §5 |
| Portability | Import/Export / Sync / Profile | §6 |
| Customization | Theme / Keymap / Layout / Behavior | §7 |
| Platform | i18n / a11y / Update / Telemetry | §8 |
| Infra | Storage / IPC / Crypto / Network / Logger | §9 |

---

## 3. 核心 Coding Agent 能力

本章节是产品的灵魂。一个 Coding Agent 的「智能」本质上由四个引擎决定:
**提示词 (Prompt) × 上下文 (Context) × 工具骨架 (Harness) × 循环 (Loop)**。

### 3.1 提示词系统 (Prompt Engineering System)

#### 3.1.1 能力定义

提示词系统负责将「角色、能力、约束、任务、上下文、用户意图、模型适配」组装成最终送入 LLM 的消息序列。它必须**可分层、可覆盖、可版本化、可调试**。

#### 3.1.2 子能力拆解

##### A. System Prompt 分层架构

采用 **七层洋葱模型**,从外到内依次 (后者覆盖前者):

| 层 | 名称 | 来源 | 可覆盖 | 说明 |
|----|------|------|--------|------|
| L1 | Base Identity | 内置 | 是 | 你是一个编码智能体… 能力边界声明 |
| L2 | Persona | Profile | 是 | 风格 (简洁/详尽/严格/Socratic) |
| L3 | Capability Declaration | 内置 | 是 | 可用工具清单、可用 MCP、可用 Skills |
| L4 | Constraint & Safety | 内置+用户 | 是 | 不得删除文件、必须确认破坏性操作、伦理约束 |
| L5 | Task Type Template | 任务路由 | 是 | refactor / debug / TDD / review / scaffold… |
| L6 | Dynamic Context | 运行时 | 否 | 项目语言、Git 状态、当前选区、时间预算 |
| L7 | User Override | 用户 | — | 用户在会话中追加的 system 指令 |

> **设计决策 D3.1**: 用户覆盖允许通过 `CLAUDE.md` / `AGENTS.md` / `OpenWork.md` 项目级指令文件注入,与 Claude Code / Codex 生态对齐,降低迁移成本。

##### B. 提示词模板管理

- **内置模板库**: 覆盖 refactor / debug / TDD / code-review / commit-message / PR-description / scaffold / explain / migrate / security-audit 等 20+ 场景。
- **模板语法**: 支持 Jinja2 / Handlebars 风格变量插值,内置变量:
  - `{{project.language}}`, `{{project.framework}}`, `{{git.branch}}`, `{{git.diff}}`
  - `{{selection.code}}`, `{{selection.range}}`, `{{file.path}}`
  - `{{context.budget}}`, `{{model.name}}`, `{{task.type}}`
  - `{{user.preferences}}`, `{{profile.name}}`
- **模板继承**: 子模板 `extends: base.refactor`,可覆盖片段。
- **模板覆盖优先级**: 内置 < 全局用户 < 项目级 < 会话临时。

##### C. 动态 Prompt 组装

非静态拼接,而是基于运行时状态的动态构造:

- **任务类型路由**: 根据用户意图自动选择模板 (可被 `--template` 或 UI 强制)。
- **模型适配**: 同一意图在不同模型上有不同变体 (例如 Claude 用 XML 标签、GPT 用 Markdown、本地模型需更明确指令)。通过 `model_adapter` 映射表实现。
- **工具感知**: 仅当工具可用时才在 prompt 中声明该工具,避免「幻觉调用」。
- **Token 预算感知**: 上下文超预算时,优先压缩 L6 动态上下文,保留 L1-L5。

##### D. 提示词版本管理

- 每个模板带 `version` 与 `changelog`。
- Profile 切换时记录所用的 prompt 版本快照。
- 会话回放 (§5) 可精确复现 prompt。
- 支持模板 diff,便于回归测试。

##### E. 提示词调试与测试

- **Prompt Inspector**: UI 面板展示最终组装的完整 prompt,支持按层展开、折叠、复制。
- **Prompt Playground**: 离线调试单个 prompt,可对比不同模板 / 模型的输出。
- **Prompt Regression Test**: 把 (prompt, 期望行为) 形式化为测试用例,CI 可跑。
- **A/B 测试**: 同一任务对两个 prompt 版本并行执行,人工或 LLM-as-Judge 评估。

##### F. 模型适配层

- 不同模型对工具调用协议 (function calling vs XML vs JSON mode) 的差异由适配层抹平。
- 不同模型的 system prompt 长度限制 / 截断策略可配置。
- 本地小模型可启用「指令重写」: 用强模型把用户输入重写为更适合小模型的明确指令。

#### 3.1.3 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| D3.1 | 支持 `AGENTS.md` / `CLAUDE.md` / `OpenWork.md` 多文件名兼容 | 降低生态迁移成本 |
| D3.2 | Prompt 分层而非单一字符串 | 支持部分覆盖、便于调试 |
| D3.3 | 模板使用 Jinja2 风格 | 开发者熟悉度高,生态成熟 |
| D3.4 | Prompt 随会话持久化,可回放 | 可复现是 Agent 工程核心要求 |

#### 3.1.4 配置项与默认值

```yaml
prompt:
  base_identity_file: "config/prompts/base.md"
  persona:
    preset: "concise"        # concise | detailed | socratic | strict
    custom_file: null
  task_routing: true
  model_adapter: auto        # auto | claude | openai | local
  token_budget_strategy: "compress-dynamic"  # compress-dynamic | truncate-tail | summarize
  override_files:
    - "AGENTS.md"
    - "CLAUDE.md"
    - "OpenWork.md"
  template_dir: "config/prompts/templates"
  inspector:
    enabled: true
    capture_layer_diff: true
  versioning:
    enabled: true
    snapshot_per_session: true
```

---

### 3.2 上下文工程 (Context Engineering)

#### 3.2.1 能力定义

上下文工程决定「Agent 在每一次推理时,知道什么、忘记什么、如何检索、如何压缩」。它直接决定输出质量与成本。本系统的目标是: **在有限 token 预算内,最大化任务相关信息的信噪比**。

#### 3.2.2 子能力拆解

##### A. 上下文来源 (Source Taxonomy)

| 类别 | 来源 | 采集方式 | 默认权重 |
|------|------|----------|----------|
| 显式上下文 | 用户选中代码 / @文件 / @符号 | UI / 指令 | 高 |
| 文件上下文 | 当前文件、相关文件 | 自动 + 手动 | 高 |
| 代码库索引 | 全仓库符号、依赖图 | 后台索引 | 中 (RAG 召回) |
| Git 上下文 | diff / log / branch / blame | 自动 | 中 |
| 终端上下文 | 最近命令、输出 | 自动 (白名单) | 中 |
| 编辑器上下文 | 光标、诊断 (LSP)、折叠区 | 自动 | 中 |
| 浏览器上下文 | 文档页 / 控制台 / 网络 | 插件采集 | 低 (可选) |
| 项目配置 | package.json / pyproject / tsconfig | 自动 | 中 |
| 会话历史 | 当前会话 + 跨会话记忆 | 持久化 | 高 |
| 外部知识 | 文档 RAG / Web | 按需 | 低 |

##### B. 上下文压缩与摘要 (Compression)

**分层摘要策略**:

1. **近因窗口 (Recency)**: 最近 N 轮对话原样保留。
2. **摘要窗口 (Summary)**: 较早的对话按 K 轮分块,每块 LLM 摘要为 1-2 句。
3. **事实窗口 (Facts)**: 从摘要中抽取「已确认的事实」(决策、约束、已完成项),结构化为 key-value,长期保留。
4. **代码指纹 (Code Fingerprint)**: 已读文件记录 hash + 摘要,避免重复读全文。

**Token 预算管理**:

- 全局预算 = `model.context_window - reserve_for_output - reserve_for_tools - reserve_for_dynamic`。
- 每个来源按权重分配子预算,超限时触发压缩。
- 压缩策略可配置: `compress-dynamic` (默认) / `truncate-tail` / `summarize-all` / `drop-low-weight`。
- **重要度排序**: 基于相关性 (向量) × 时效性 × 用户标记,加权打分。

##### C. 上下文检索 (RAG / Hybrid Retrieval)

- **索引策略**:
  - 文件级: 路径、语言、大小、依赖。
  - 符号级: 类、函数、变量定义/引用 (基于 Tree-sitter)。
  - 块级: 按 AST 切分,每块带向量。
- **向量索引**: 本地内嵌 (sqlite-vec / LanceDB) 或外接 (Qdrant/Chroma)。
- **检索方式**:
  - 语义检索 (向量)
  - 关键词检索 (BM25 / FTS5)
  - 结构检索 (符号 / 引用图 / 调用链)
  - **混合排序**: RRF (Reciprocal Rank Fusion) 融合多路结果。
- **检索触发**: 显式 (`@symbol`) 与隐式 (LLM 主动调用 `search_codebase` 工具)。

##### D. 上下文窗口管理 (Window Management)

- **优先级队列**: 上下文项按优先级入队,驱逐策略 LRU + 重要度。
- **钉选 (Pin)**: 用户可钉选某文件/某段,不被驱逐。
- **驱逐日志**: 被丢弃的内容记录,允许用户「找回」。
- **动态窗口**: 根据任务复杂度调整 (简单查询用小窗口降成本,复杂重构用大窗口)。

##### E. 上下文可视化与可观测

- **Token 仪表盘**: 实时展示当前 prompt 的 token 占用,按来源分块着色。
- **上下文来源树**: 展示每次推理实际发送了哪些文件、哪些摘要、哪些检索结果。
- **驱逐告警**: 当关键上下文被驱逐时 UI 提示。
- **Diff 模式**: 对比前后两次推理的上下文变化。

##### F. 记忆系统 (Memory)

分三级记忆,对应 §5 持久化:

| 记忆级别 | 范围 | 生命周期 | 用途 |
|----------|------|----------|------|
| 工作记忆 | 当前会话 | 会话结束清空 (可存档) | 当前任务上下文 |
| 项目记忆 | 当前项目 | 持久 | 项目约定、决策、教训 (类似 `AGENTS.md` 增强版) |
| 全局记忆 | 跨项目 | 持久 | 用户偏好、通用经验 |

记忆的写入由 Agent 主动调用 `memory_write` 工具,或由 Hooks 自动提取 (如任务完成后自动总结决策)。

#### 3.2.3 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| D3.5 | 采用分层摘要而非全文截断 | 保留长期事实,降低信息丢失 |
| D3.6 | 默认混合检索 (向量+BM25+结构) | 单一检索召回不足,代码场景结构信号强 |
| D3.7 | 索引本地优先,向量库可换 | 兼顾隐私与扩展 |
| D3.8 | 上下文驱逐可回溯 | 避免黑盒,便于调试 |

#### 3.2.4 配置项与默认值

```yaml
context:
  sources:
    explicit: { weight: 1.0, auto_pin: true }
    file:    { weight: 0.9 }
    repo_index: { weight: 0.6 }
    git:     { weight: 0.7 }
    terminal: { weight: 0.5, whitelist: ["git", "npm", "cargo"] }
    editor:  { weight: 0.7 }
    browser: { weight: 0.3, enabled: false }
  compression:
    strategy: "compress-dynamic"
    recency_window: 6        # 最近 6 轮原样
    summary_chunk: 4         # 每 4 轮摘要
    facts_extraction: true
  budget:
    policy: "model_aware"   # model_aware | fixed
    reserve_output: 4096
    reserve_tools: 2048
  retrieval:
    vector_backend: "embedded"  # embedded | qdrant | chroma
    hybrid: true
    top_k: 10
    rrf_k: 60
  memory:
    work:  ephemeral_archivable
    project: "AGENTS.md + .OpenWork/memory.jsonl"
    global: "~/.OpenWork/memory/global.jsonl"
  eviction:
    policy: "lru_importance"
    log_evicted: true
```

---

### 3.3 Harness 工程 (Agent Harness Engineering)

#### 3.3.1 能力定义

Harness 是「承载 Agent 运行的工程骨架」: 它定义工具如何注册与调用、权限如何仲裁、模型如何抽象、执行如何被管控。一个 Harness 的好坏决定 Agent 的**能力上限、安全性、可扩展性**。

#### 3.3.2 子能力拆解

##### A. 工具系统 (Tool System)

**内置工具集** (一等公民,默认可用,可禁用):

| 工具 | 能力 | 风险等级 |
|------|------|----------|
| `read_file` | 读取文件 (含行范围) | 低 |
| `write_file` | 写文件 (含新建/覆盖) | 高 |
| `edit_file` | 精确字符串替换 / 多点编辑 | 高 |
| `delete_file` | 删除文件 | 极高 |
| `move_file` | 移动/重命名 | 高 |
| `glob` | 文件名模式匹配 | 低 |
| `grep` | 内容正则搜索 (ripgrep 内核) | 低 |
| `search_codebase` | 语义搜索 | 低 |
| `run_command` | 执行终端命令 | 极高 |
| `run_background` | 后台长任务 (dev server 等) | 中 |
| `editor_action` | 光标移动/折叠/格式化 | 低 |
| `diagnostics` | 获取 LSP 诊断 | 低 |
| `browser_*` | 导航/点击/截图/抓取 | 中 |
| `web_search` | 联网搜索 | 低 |
| `web_fetch` | 抓取网页为 markdown | 低 |
| `memory_*` | 读写记忆 | 低 |
| `todo_write` | 任务清单管理 | 低 |
| `task_spawn` | 派生 Sub-Agent | 中 |
| `mcp_call` | 调用 MCP 工具 | 继承 |
| `skill_invoke` | 调用 Skill | 继承 |

**工具注册与发现**:
- 声明式注册: 每个工具以 schema (JSON Schema) 描述入参/出参/风险/是否流式。
- 插件与 MCP 动态注册的工具进入同一 Registry,但带 `source` 标记 (内置/插件/MCP/Skill)。
- 工具元数据: `id`, `name`, `description`, `schema`, `risk`, `requires_approval`, `timeout`, `streaming`, `category`。

**工具调用流程**:
```
LLM 请求调用 tool_X(args)
   │
   ▼
[Permission Gateway] 校验权限 (自动/确认/拒绝/询问)
   │
   ▼
[Tool Dispatcher] 路由到对应 Worker
   │
   ▼
[Sandbox] 在受限环境执行 (路径白名单 / 资源限制)
   │
   ▼
[Audit] 记录调用 + 入参 + 出参 + 耗时 + 结果
   │
   ▼
回流到 Loop (作为 observation)
```

##### B. 权限与安全 (Permission & Safety)

**权限分级**:
| 级别 | 行为 | 示例 |
|------|------|------|
| L0 ReadOnly | 自动允许 | read/grep/glob |
| L1 Mutate | 配置策略决定 (auto/approve/deny) | write/edit |
| L2 Destructive | 默认需确认 | delete/run_command |
| L3 Critical | 永远需确认,且记录不可擦除审计 | rm -rf / force push / sudo |

**确认机制**:
- 每个会话维护「已批准工具签名」缓存,减少重复确认。
- 支持一次性批准、本会话批准、本项目批准、永久批准 (写入 Profile)。
- 危险操作支持 dry-run 预览 (如 `edit_file` 显示 diff)。

**沙箱执行**:
- 文件操作限制在项目根 + 显式 allowlist 之外拒绝。
- 终端命令通过 allowlist (glob/正则) + blocklist (rm -rf, sudo, push --force…) 双重过滤。
- 可选 Docker / Firejail / WASM 沙箱模式 (企业版强化)。
- 网络访问可按域名白名单限制。

**审计**:
- 所有工具调用记录到本地审计日志 (JSONL),含时间、调用方 (主 Agent / Sub-Agent)、入参摘要、结果摘要、是否人工批准。
- 审计日志只追加 (append-only),支持签名防篡改 (可选)。

##### C. 模型抽象层 (Model Abstraction)

**Provider 抽象**:
- 统一接口: `chat(messages, tools, config) -> stream<chunk>`
- 内置 Provider: OpenAI / Anthropic / Google / Azure / Bedrock / Ollama / llama.cpp / vLLM / 任意 OpenAI 兼容。
- 每个 Provider 适配: 流式协议、工具调用协议、系统消息位置、stop 序列、token 计数。

**模型路由 (Router)**:
- 按任务类型路由: 简单查询 → 小模型,复杂重构 → 大模型,TDD → 推理强模型。
- 按成本路由: 预算超限时降级到便宜模型。
- 按延迟路由: 交互式优先低延迟模型,后台任务用高吞吐模型。

**Fallback & 重试**:
- 主模型失败自动 fallback 到备选链。
- 限流 / 超时 / 网络错误差异化重试策略 (指数退避 + 抖动)。

**成本控制**:
- 实时累计 token / 费用,会话级 + 日级 + 项目级预算。
- 超预算行为可配置: 警告 / 降级 / 暂停。

##### D. 执行引擎 (Execution Engine)

- **同步执行**: 标准工具调用,阻塞等待结果。
- **流式执行**: 输出流式回显,工具结果就绪即回流。
- **并发执行**: Agent 可一次请求多个独立工具,引擎并发调度。
- **后台执行**: 长任务 (dev server, 测试套件) 后台运行,状态轮询。
- **超时管理**: 每个工具有默认 + 可覆盖超时。
- **错误恢复**: 工具失败时返回结构化错误给 LLM,而非抛异常中断 Loop。
- **可中断**: 用户随时按 ESC / 停止按钮,优雅终止当前工具与 Loop。

#### 3.3.3 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| D3.9 | 工具与 LLM 解耦,经权限网关 | 安全可控,可审计 |
| D3.10 | 模型抽象层抹平协议差异 | 解耦上层与具体供应商 |
| D3.11 | 审计日志 append-only + 可签名 | 合规与可复现 |
| D3.12 | 工具失败返回结构化错误而非中断 | 让 Agent 自我修复 |

#### 3.3.4 配置项与默认值

```yaml
harness:
  tools:
    builtin_enabled: true
    disabled: []                # 工具 id 列表
  permission:
    default_policy: "approve"  # auto | approve | deny
    per_tool:
      run_command: "approve"
      delete_file: "always_confirm"
    approval_cache: session    # once | session | project | permanent
  sandbox:
    file_scope: "project+allowlist"
    command:
      allowlist: []
      blocklist: ["rm -rf /", "sudo", "git push --force", "> /dev/"]
    network_whitelist: null
    mode: "native"             # native | docker | wasm
  audit:
    enabled: true
    append_only: true
    sign: false
  model:
    primary: "anthropic:claude-sonnet-4"
    fallback: ["openai:gpt-4o", "ollama:qwen2.5-coder"]
    router:
      task_routing: true
      cost_routing: true
      budget:
        session_usd: 5.0
        daily_usd: 20.0
        on_exceed: "warn"      # warn | degrade | pause
  execution:
    concurrency: 4
    default_timeout: 60s
    interruptible: true
```

---

### 3.4 Loop 工程 (Agent Loop Engineering)

#### 3.4.1 能力定义

Loop 是 Agent 的「心跳」。它决定 Agent 如何从感知到行动、何时停止、如何反思、如何把大任务分解为可执行的子循环。一个良好的 Loop 工程应**可观测、可中断、可干预、可嵌套**。

#### 3.4.2 子能力拆解

##### A. 核心循环 (Core Loop: PAOR)

标准 ReAct 升级版,四阶段:

```
   ┌─────────────────────────────────────────┐
   │   P (Perceive)  感知: 整合上下文与用户输入 │
   ▼                                         │
   │   A (Act)       行动: 选择并调用工具        │
   ▼                                         │
   │   O (Observe)   观察: 解析工具结果          │
   ▼                                         │
   │   R (Reflect)   反思: 评估进度/修正计划     │
   └──────────── 循环直到完成或终止 ──────────┘
```

- **Perceive**: 调用 Context Engine 组装最新上下文,识别任务意图。
- **Act**: LLM 决策调用哪个工具 (含 0 个工具,即纯文本回答)。
- **Observe**: 解析工具输出,结构化为 observation,写回工作记忆。
- **Reflect**: 每 N 轮触发一次显式反思 (LLM 自评: 进度如何?是否走偏?是否需要重新规划?)。

##### B. 子循环 (Sub-Loops)

针对复杂任务,在主循环之上叠加专用子循环:

| 子循环 | 触发 | 行为 |
|--------|------|------|
| **Planning Loop** | 复杂任务 (需多文件/多步骤) | 先产出 plan (TodoList + 依赖),再执行 |
| **Execution Loop** | plan 中的子任务 | 串行/并行执行单个子任务 |
| **Verification Loop** | 代码改动后 | 跑测试 / 类型检查 / Lint / 自查 |
| **Reflection Loop** | 每 N 轮 或 阶段完成 | 自评,必要时重规划 |
| **Recovery Loop** | 工具失败/测试失败 | 分析错误,尝试修复,最多 K 次 |

##### C. 循环控制 (Loop Control)

- **终止条件**: 任务完成 / 达到最大迭代 / 用户停止 / 成本超限 / 不可恢复错误。
- **最大迭代**: 全局上限 + 单子任务上限,防止死循环烧钱。
- **中断与恢复**:
  - 用户可在任意点暂停 (不是终止),保存 Loop 状态。
  - 恢复后从最近 checkpoint 继续,重新组装上下文。
  - 支持「时间旅行」: 回退到历史某一步重放 (受非确定性影响,标注)。
- **人工干预点 (HITL Checkpoints)**:
  - 默认: 破坏性操作前确认。
  - 可配置: 每步都确认 (教学模式) / 关键节点确认 (默认) / 全自动 (信任模式)。
  - 干预动作: 批准 / 修改 / 拒绝 / 接管 (用户手动执行剩余)。

##### D. 任务编排 (Task Orchestration)

- **任务分解**: Planning Loop 把大任务拆为带依赖的 DAG。
- **依赖管理**: 拓扑排序执行,无依赖项可并行。
- **结果聚合**: 子任务结果按策略聚合 (合并 / 取最新 / 人工裁决)。
- **进度可视化**: UI 展示任务树、当前节点、阻塞原因。

##### E. 多 Agent 协作 (Multi-Agent)

- **主从模式**: 主 Agent 派生 Sub-Agent 处理子任务 (如「读 5 个文件总结」)。
- **并行模式**: 多个 Sub-Agent 并行处理独立子任务。
- **专家模式**: 不同 Sub-Agent 装载不同 Persona/Skills (重构专家 / 安全专家 / 测试专家)。
- **通信协议**: Sub-Agent 通过结构化消息 (JSON) 与主 Agent 通信,不直接共享上下文 (隔离)。
- **成本归属**: Sub-Agent 的 token / 成本归属到父任务。

##### F. Loop 可观测性

- **Loop Trace**: 每一步的 Perceive/Act/Observe/Reflect 记录为 trace,可回放。
- **决策可视化**: 展示 Agent 在每步选择了哪个工具、为什么。
- **耗时与成本归因**: 每步的 token / 耗时 / 成本,定位瓶颈。
- **Loop 调试器**: 类 IDE 调试器,支持断点 (在指定工具调用前暂停)、单步、条件断点。

#### 3.4.3 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| D3.13 | 采用 PAOR 而非纯 ReAct | 显式反思提升复杂任务成功率 |
| D3.14 | 子循环可配置开关 | 不同任务最优策略不同 |
| D3.15 | Loop 状态可序列化、可恢复 | 长任务不丢失,可时间旅行 |
| D3.16 | Sub-Agent 上下文隔离 | 防止上下文污染、降低成本 |

#### 3.4.4 配置项与默认值

```yaml
loop:
  max_iterations: 50
  max_iterations_per_subtask: 15
  reflection_interval: 5
  planning:
    auto_plan_threshold: 3      # 预计步数 > 3 触发 planning
    require_user_approve_plan: false
  verification:
    auto_run_tests: true
    auto_lint: true
    auto_typecheck: true
  recovery:
    max_retries: 3
    on_persistent_failure: "ask"  # ask | abort | escalate
  hitl:
    mode: "key_nodes"            # every_step | key_nodes | trust
    confirm_on: [delete, run_command, force_push, irreversible]
  sub_agent:
    enabled: true
    max_parallel: 4
    context_isolation: true
  checkpoint:
    enabled: true
    interval: "every_step"       # every_step | every_n | on_demand
  trace:
    enabled: true
    capture_observations: true
```

---

## 4. 扩展能力 (Extensibility)

扩展能力是开源 Coding Agent 的生态护城河。本产品在扩展面上提供**五条等价通道**,任一通道都能让用户改变 Agent 行为。

### 4.1 MCP (Model Context Protocol) 一等公民支持

- **MCP Client**: 内置完整 MCP Client,支持 stdio / SSE / HTTP 三种 transport。
- **MCP Server 管理**:
  - UI 化添加 / 编辑 / 启停 MCP Server。
  - 配置存储于 Profile (§6),可版本化。
  - 健康检查 / 自动重连 / 状态指示。
- **内置 MCP Server**: 开箱即用提供 filesystem / git / fetch / sqlite 等常用 server,作为可选增强。
- **工具合并**: MCP 工具与内置工具进入同一 Registry,统一权限与审计。
- **资源 (Resources) / Prompts (Prompts) 支持**: 不仅消费 tools,还消费 MCP 暴露的 resources 与 prompts 模板。

```yaml
mcp:
  servers:
    - name: "filesystem"
      transport: stdio
      command: "npx"
      args: ["-y", "@modelcontextprotocol/server-filesystem", "{{project.root}}"]
      enabled: true
      auto_restart: true
    - name: "github"
      transport: http
      url: "https://mcp.github.example/sse"
      auth: { type: bearer, token_env: "GITHUB_TOKEN" }
  inject_tools: true
  inject_resources: true
```

### 4.2 插件系统 (Plugin System)

- **插件形态**: npm 包 / 本地目录 / WASM 模块。
- **插件 API**:
  - 注册工具 / 命令 / Skills / Hooks / UI 面板 / 设置项 / Persona。
  - 拦截器: 在 Loop 各阶段注入逻辑 (pre_act / post_observe / on_plan)。
- **插件生命周期**: install → enable → configure → run → disable → uninstall。
- **沙箱**: 插件默认运行于隔离 Worker,权限按声明授予 (filesystem/network/ui/…),用户批准。
- **插件市场**: 内置市场入口,支持索引、安装、更新、评分 (初期可对接开源 registry)。
- **插件开发 SDK**: 提供 TS SDK,脚手架 `openwork plugin create`。
- **manifest 示例**:
  ```json
  {
    "name": "openwork-jira",
    "version": "1.0.0",
    "engines": { "openwork": "^1.0" },
    "permissions": ["network:https://*.atlassian.net", "ui:panel"],
    "contributes": {
      "tools": ["./tools/issue.js"],
      "commands": ["./commands/create-issue.js"],
      "hooks": { "on_task_complete": "./hooks/log-to-jira.js" }
    }
  }
  ```

### 4.3 自定义工具 (Custom Tools)

- 用户可用 TS / Python / Shell 定义工具,声明 schema 后注册。
- 支持工具版本化、热重载。
- 工具可声明依赖 (如需某 MCP server 在线)。

### 4.4 Slash Commands (自定义命令)

- 内置命令: `/help`, `/clear`, `/model`, `/config`, `/history`, `/replay`, `/diff`, `/undo`, `/checkpoint`, `/export`, `/profile`, `/mcp`, `/skill`, `/agent`…
- 用户自定义命令: 一个命令 = 一段 Prompt 模板 + 可选前置脚本 + 可选工具白名单。
- 命令可参数化、可链式、可绑定快捷键。
- 项目级命令: `.OpenWork/commands/*.md`。

### 4.5 Sub-Agent (子智能体)

- 用户可定义专用 Sub-Agent (Persona + 工具白名单 + Skills),由主 Agent 或命令派生。
- 用途: 隔离上下文、专家分工、并行加速、降低主上下文污染。
- 配置示例:
  ```yaml
  sub_agents:
    - id: "reviewer"
      persona: "strict senior code reviewer"
      tools: [read_file, grep, diagnostics]
      skills: ["web-design-guidelines"]
    - id: "test-writer"
      persona: "TDD practitioner"
      tools: [read_file, write_file, run_command, edit_file]
  ```

### 4.6 Hooks 系统 (Hooks)

- 在 Agent 生命周期的固定点触发用户脚本:
  - `on_session_start` / `on_session_end`
  - `pre_plan` / `post_plan`
  - `pre_act` (可拦截/改写工具调用)
  - `post_observe` (可改写 observation)
  - `on_tool_call` / `on_tool_result`
  - `on_file_change` / `on_test_fail`
  - `on_task_complete`
- Hook 脚本可返回结构化结果影响 Loop (如注入额外上下文、阻止危险操作)。
- 用途: 自动 lint on save、提交前检查、自动同步外部系统、安全策略强制。

### 4.7 Skills 系统 (Skills)

- Skill = 可复用的「提示词 + 工具白名单 + 工作流 + 可选脚本」封装。
- 与「插件」区别: Skill 主要是 prompt/workflow 层扩展,不引入新代码运行时。
- 内置 Skills 库 (参考对标): TDD / commit / PR / code-review / debug / refactor / scaffold / docs / migration / security-audit …。
- 用户可创建、分享、安装 Skills (`.OpenWork/skills/*.yaml`)。
- Skill 可声明前置依赖 (如需要某 MCP server)。
- Skill 可被命令、快捷键、或 Agent 自动调用 (基于意图识别)。

### 4.8 扩展能力总览矩阵

| 通道 | 改变什么 | 形态 | 沙箱 | 章节 |
|------|----------|------|------|------|
| MCP | 工具/资源/Prompt | 外部进程 | 是 | §4.1 |
| 插件 | 工具/命令/UI/Hook/Persona | 代码包 | 是 | §4.2 |
| 自定义工具 | 工具 | 脚本 | 是 | §4.3 |
| Slash Command | Prompt/工作流 | Markdown/脚本 | 否 (prompt 层) | §4.4 |
| Sub-Agent | Persona/工具白名单 | 配置 | 继承 | §4.5 |
| Hooks | 生命周期行为 | 脚本 | 是 | §4.6 |
| Skills | Prompt/工作流 | YAML+脚本 | 否 (prompt 层) | §4.7 |

---

## 5. 持久化能力 (Persistence)

> **原则**: 一切皆可持久化、一切皆可回放、一切皆可导出。

### 5.1 会话持久化 (Session Persistence)

- 每个会话完整保存: 消息序列、工具调用、Loop trace、prompt 快照、上下文快照、子任务树、检查点。
- 支持会话归档、搜索、标签、收藏、恢复。
- 会话可分支: 从历史某点 fork 出新会话探索不同路径。
- 跨重启自动恢复 (崩溃恢复)。

### 5.2 记忆持久化 (Memory Persistence)

- 工作记忆: 会话级,可手动转存为项目记忆。
- 项目记忆: `.OpenWork/memory.jsonl` + `AGENTS.md` (可读人写)。
- 全局记忆: `~/.OpenWork/memory/global.jsonl`。
- 记忆可分类 (decision / fact / preference / lesson / todo),可搜索、可编辑、可遗忘。

### 5.3 配置持久化 (Configuration Persistence)

- 多级配置 (优先级高→低): 命令行参数 > 会话临时 > 项目 `.OpenWork/` > 全局 `~/.OpenWork/` > 内置默认。
- 配置格式: YAML (人友好) + JSON Schema 校验。
- 配置变更历史版本化 (Git-like),可回滚。
- 配置热加载: 修改文件即时生效,无需重启。

### 5.4 索引持久化 (Index Persistence)

- 代码库向量索引 / 符号表 / FTS 索引持久化到本地。
- 增量更新: 文件变更触发增量重索引,而非全量。
- 索引版本与代码库 commit 绑定,可快速回滚到历史版本。
- 多项目索引隔离。

### 5.5 审计与日志 (Audit & Logs)

- 工具调用审计日志 (§3.3)。
- 模型调用日志: provider / model / token / 成本 / 延迟 / 错误。
- 系统日志: 分级 (debug/info/warn/error),轮转,可导出。
- 隐私分级: 敏感字段 (密钥、私内容) 可配置脱敏。

### 5.6 存储选型

| 数据 | 选型 | 理由 |
|------|------|------|
| 会话/记忆/审计 | SQLite (WAL) | 事务、查询、单文件易迁移 |
| 配置 | YAML 文件 | 人可读、Git 友好 |
| 向量索引 | sqlite-vec (默认) / LanceDB | 本地优先,可换 |
| 全文索引 | SQLite FTS5 | 与主库一致 |
| 大文件 (trace) | JSONL + 压缩 | 流式追加,可压缩 |
| 缓存 | 本地 KV (LevelDB/文件) | 临时数据 |

存储位置:
```
~/.OpenWork/
  ├── config/            # 全局配置
  ├── memory/global.jsonl
  ├── sessions/         # SQLite + 附件
  ├── indexes/          # 向量/FTS
  ├── logs/
  ├── audit/
  ├── cache/
  └── plugins/
<project>/.OpenWork/
  ├── config.yaml       # 项目级配置
  ├── memory.jsonl
  ├── commands/
  ├── skills/
  ├── prompts/
  └── agents.md / claude.md / OpenWork.md
```

---

## 6. 可迁移能力 (Portability & Migration)

### 6.1 配置导入导出

- 一键导出: 全局配置 + 选定 Profile + 自定义 Prompt/Skill/Command 模板,打包为 `.OpenWork-bundle.zip`。
- 一键导入: 解包并合并,冲突策略可选 (skip/overwrite/rename)。
- 包含 manifest: 版本、来源、生成时间、内容清单。

### 6.2 会话导入导出

- 会话导出为 JSON / Markdown (人类可读) / 重放包 (机器可复现)。
- 导入: 从其他工具 (Claude Code / Cline / Aider) 的历史格式转换导入。

### 6.3 跨平台同步

- 桌面端跨 OS: Windows / macOS / Linux 配置路径自动适配。
- 可选云同步: 通过 WebDAV / S3 / Git 仓库同步配置与记忆 (不含会话敏感数据,除非显式开启)。
- 端到端加密: 同步前本地加密,密钥用户持有。

### 6.4 团队共享

- **Profile (§7)** 作为团队配置单元,可发布到 Git 仓库 / 内部市场。
- 团队成员 `openwork profile use team-frontend` 一键拉取应用。
- Skills / Commands / Sub-Agent / MCP 配置随 Profile 分发。
- 支持「团队约定」层: 强制项 (force) 与建议项 (recommend) 分离,便于治理。

### 6.5 与竞品互操作

- 兼容 `AGENTS.md` / `CLAUDE.md` / `.cursorrules` / `.clinerules` 读取。
- MCP 配置与 Claude Desktop / Cursor / Cline 格式互转。
- 模型 Provider 配置可导入 OpenRouter / LiteLLM 格式。

---

## 7. 高度自定义可配置化 (Customization & Configurability)

### 7.1 Profile 系统 (核心)

Profile 是「一套完整的工作环境预设」,涵盖模型、Persona、Prompt、Skill、MCP、工具白名单、权限策略、UI 偏好。

```yaml
profile:
  name: "frontend-react"
  description: "React + TS 前端开发"
  model:
    primary: "anthropic:claude-sonnet-4"
    router: { task_routing: true }
  persona: "concise"
  skills: ["frontend-design", "web-design-guidelines", "shadcn"]
  mcp_servers: ["filesystem", "github"]
  tools:
    enabled: [read, write, edit, grep, glob, run_command, web_search]
    disabled: [delete_file]
  permission:
    default: "approve"
    confirm_on: [run_command, force_push]
  prompt_overrides:
    - file: "prompts/react-refactor.md"
      layer: "task"
  ui:
    theme: "tokyonight"
    layout: "focus"
```

- 多 Profile 共存,一键切换,会话内绑定。
- Profile 可继承 (extends),便于团队基线 + 个人定制。
- Profile 可导出/导入/分享 (§6)。

### 7.2 主题系统

- 内置主题: TokyoNight / Catppuccin / Dracula / GitHub / Gruvbox / One Dark / Nord …。
- 自定义主题: JSON 定义色板 (语法高亮 / UI / 终端 三套同步)。
- 与编辑器主题联动 (可选)。
- 支持跟随系统深浅色。

### 7.3 快捷键 (Keymap)

- 全局快捷键可重绑,预设: VSCode / Vim / Emacs / 自定义。
- 命令面板 (Ctrl+Shift+P 风格) 暴露所有可快捷键操作。
- 支持 Vim 模式 (modal editing) 用于对话与编辑。

### 7.4 布局 (Layout)

> **实现说明** (v1.1): 界面布局统一使用 **@lobehub/ui Layout 组件体系**（Layout/LayoutHeader/LayoutMain/LayoutSidebar/LayoutToc + DraggablePanel），**替代 react-resizable-panels 方案**。遵循设计决策 D9.3 的 UI 框架优先级策略。详见 [09 文档 v1.2 §0.4](./09-LobeHub生态集成方案.md)。

- 可调面板: 对话 / 上下文 / Diff 预览 / Loop trace / 终端 / 文件树 / 检查器。
- 预设布局: focus (仅对话) / dev (对话+终端) / debug (对话+trace+检查器) / review (对话+diff)。
- 布局可保存为命名预设,随 Profile 携带。

### 7.5 行为配置 (Behavior)

覆盖几乎所有 Agent 行为开关: 是否自动规划、是否自动跑测试、HITL 模式、压缩策略、成本预算… (见各章配置项)。

### 7.6 工作流配置 (Workflow)

- 可定义「工作流」: 多步骤 Prompt + 工具序列 + 触发条件,作为高级 Skill。
- 工作流可视化编辑器 (节点 / 连线)。
- 内置模板: feature-flow (spec→impl→test→review→commit) / bug-flow (repro→root-cause→fix→verify)。

### 7.6 配置界面 (Settings UI)

- 设置面板分层: 通用 / 模型 / Agent / 工具 / MCP / 插件 / 外观 / 快捷键 / 同步 / 高级。
- 每项配置带说明、默认值、校验。
- 支持搜索 + 命令行式快速设置 (`openwork set loop.max_iterations 50`)。
- 导出当前设置为 Profile。

---

## 8. 其他功能需求 (Other Features)

### 8.1 多语言 / 国际化 (i18n)

- UI i18n: 中 / 英 / 日,社区可贡献翻译。
- Prompt i18n: 内置模板多语言版本,按用户语言选择。
- Agent 输出语言: 跟随用户语言 (可强制)。

### 8.2 无障碍 (a11y)

- 全键盘可达,屏幕阅读器友好 (ARIA)。
- 高对比度主题,字体大小调节,关闭动画选项。
- 终端区域支持放大镜 / 行聚焦。

### 8.3 性能监控 (Performance)

- 启动性能: 冷启动 < 2s (SSD)。
- 大仓库索引: 10 万文件 < 60s 首索引,增量 < 5s。
- 内存占用: 空闲 < 300MB,峰值可配上限。
- 性能面板: CPU / 内存 / token / 延迟实时图表。

### 8.4 成本分析 (Cost Analytics)

- 按 会话 / 项目 / 日 / 模型 维度统计 token 与费用。
- 预算预警与熔断。
- 成本归因到 Loop 步骤与 Sub-Agent。

### 8.5 更新机制 (Update)

- 自动检查更新,支持渐进式 / 手动。
- 更新签名校验。
- 历史版本归档,可回滚。

### 8.6 遥测与隐私 (Telemetry & Privacy)

- 默认关闭遥测,首次启动明确征询。
- 仅采集匿名使用统计 (功能开关频率、错误堆栈),不含代码 / prompt / 文件内容。
- 完整可关,且可查看采集内容。

### 8.7 安全与合规

- API Key 加密存储 (OS keychain: macOS Keychain / Windows Credential Manager / Linux Secret Service)。
- 供应链: 依赖锁定 + SBOM 生成 + 可选签名构建。
- CVE 扫描 CI。
- 企业特性 (可选): SSO / 审计导出 / DLP 集成 / 私有模型网关。

### 8.8 协作 (Collaboration, 远期)

- 会话分享: 生成只读链接 (脱敏)。
- 实时协作: 多人观察/接管同一 Agent 会话 (远期)。
- 代码评审集成: PR 评论由 Agent 起草、人工确认。

---

## 9. 技术架构与工程实现

### 9.1 技术栈选型

| 层 | 选型 (实施版 v3.3) | 理由 |
|----|------|------|
| 桌面框架 | **Electron 35** | 用户偏好，Node.js 原生集成，生态最成熟 |
| 前端 | **React 19 + TypeScript 5.7** | antd v5 + Tailwind v4 原生支持 React 19 (v1.4 重置) |
| UI 库 (v1.4 重置) | **Ant Design v5 + Tailwind CSS v4** | 企业级组件最全 + 原子布局；退役 LobeHub 生态 |
| 代码编辑器 | **Monaco Editor** | IDE 级能力 |
| AI 输入编辑器 (v1.4 重置) | **TipTap v2 + ProseMirror** | 富文本 + /命令芯片 + @文件提及 + 附件预览 (退役 @lobehub/editor) |
| 可拖拽面板 (v1.4 新增) | **react-resizable-panels 2.1** | 三栏可调面板 (替代 @lobehub/ui DraggablePanel) |
| 图标库 | **lucide-react + 自建模型 brand SVG** | 通用图标 (退役 @lobehub/icons) |
| Markdown | **react-markdown + rehype/remark 插件链** | LaTeX + 语法高亮 + 流式渲染 (退役 @lobehub/ui/mdx) |
| 代码规范 | **ESLint 9 + Prettier 3** | 直接配置 (退役 @lobehub/lint) |
| 终端 | **xterm.js** | 事实标准 |
| 后端逻辑 | **TypeScript (Node.js + Worker Threads)** | headless Agent 引擎 @openwork/core，无 Electron 依赖 (CS 分离) |
| 通信协议 (新增) | **JSON-RPC 2.0** | OpenCode-style CS 分离，多 Transport (Embedded/IPC/stdio/HTTP+SSE/WebSocket) |
| IPC | Electron IPC (contextBridge) | Electron 原生 (v0.1 仅 Embedded + Electron IPC) |
| 持久化 (v1.4 强化) | **SQLite (better-sqlite3) + DDD Repository 接口隔离 + Drizzle ORM** | domain 接口 / infra SQLite 实现；可替换为 Remote/Postgres (业务零修改) |
| 向量 | **sqlite-vec** 默认 / LanceDB | 本地优先 |
| 调度 (v1.4 新增) | **node-cron 3.x** | SCHED 域定时任务 (v0.4 启用) |
| 提示词模板 (v1.4 强化) | **Handlebars** | PROMPT 域变量插值 (v0.2+ 模板库系统) |
| Provider 抽象 (v1.4 新增) | **@openwork/ai-sdk** (自研) + openai/anthropic/gemini SDK | v0.1 落地 5 Provider；v0.3+ 自定义接入 SDK |
| CLI | **Commander.js / xterm.js** | TypeScript 实现 |
| 构建 | **npm + Vite + electron-vite + Turborepo** | 统一构建链 |
| 测试 | **Vitest + Playwright** | TS 原生测试栈 + InMemoryRepository 单测 |
| 图表 (Phase 3) | **Recharts v2** | 上游 OSS (退役 @lobehub/charts) |

> **设计决策 D9.1 (修订)**: 核心引擎 (Prompt/Context/Harness/Loop) 用 **TypeScript** 实现,运行于 Electron Main Process 的 **Worker Threads** 中以实现崩溃隔离与多核并行;前后端共享类型定义,全栈单一语言。这是「**统一性 + 生态**」的选择,牺牲部分性能换取开发效率与团队技能统一。详见 [08 文档 §2 方案 B](./08-技术选型与架构方案(实施版).md)。

> **设计决策 D9.2 (v1.4 更新)**: 采用**双编辑器架构** — 代码编辑用 Monaco (IDE 级),AI 对话输入用 **TipTap v2 (ProseMirror 富文本)** (v1.4 重置，退役 @lobehub/editor/Lexical)。各司其职,非功能冗余。详见 [08 文档 v3.8 §3.4](./08-技术选型与架构方案(实施版).md) 与 [05 文档 v4.3 §6](./05-技术选型文档.md)。

> **设计决策 D9.3 (v1.4 重置)**: **UI 框架优先级策略 — Ant Design v5 + Tailwind CSS v4 双轨**。退役 LobeHub 生态 (文档 09 已删除；原 @lobehub/ui / base-ui / @lobehub/editor / @lobehub/icons / antd v6 兜底定位 / antd-style 全部失效)。
>
> **组件优先级 (v1.4, 4 级降序)**:
> - P1 `src/components` 项目自建可复用组件 (基于 antd + Tailwind 封装) — AI 状态面板 / Agent 模式切换器 / ChatPanel / MessageList / LoopTrace / Prompt Inspector 等业务组件
> - P2 `antd` v5 原生 API — Table / Tree / Form / Modal / Drawer / Notification / Select / Tabs / Menu / Tooltip / Dropdown
> - P3 自建或可选 `@radix-ui/*` (shadcn 风格源码复制) — antd 风格不符的边缘无头原语场景 (不强制引入整库)
> - P4 自定义实现 — 真正的最后手段 (特殊定制需求)
>
> **样式方案优先级 (v1.4, 3 级降序)**:
> - S1 Tailwind utility class (建议 `tw-` prefix，与 antd 共存隔离) — 布局/间距/色彩/响应式/暗色模式
> - S2 antd `ConfigProvider` token — antd 组件级主题 (主色/圆角/字号)
> - S3 内联 `style` 或 CSS Modules — 一次性特殊样式
>
> **核心替换关系 (v1.4)**:
> - `@lobehub/ui` (base-ui + 高级 + Layout + DraggablePanel) → **antd v5 + Tailwind v4 + react-resizable-panels 2.1**
> - `@lobehub/ui Layout` + DraggablePanel → **antd Layout + react-resizable-panels 2.1**
> - `@lobehub/ui/mdx` → **react-markdown + rehype-raw + rehype-highlight + remark-gfm + remark-math + rehype-katex**
> - `@lobehub/icons` → **lucide-react + 自建模型 brand SVG**
> - `@lobehub/ui/chat` (ChatItem) → **项目自建** ChatPanel/MessageList (基于 antd + Tailwind)
> - `@lobehub/editor` (Lexical) → **TipTap v2 + ProseMirror**
> - `createStaticStyles` / antd-style → **Tailwind utility + antd ConfigProvider token**
> - `@lobehub/ui/base-ui` 无头原语 → antd 原生 + 可选 Radix 源码复制
> - `@lobehub/lint` → **ESLint 9 + Prettier 3 直接配置**
> - `@lobehub/charts` → **Recharts v2** (上游 OSS)
>
> **核心原则**:
> - `<rd>` 禁止 `import ... from '@lobehub/*'` 与 `antd-style createTheme` (CI lint 规则强制)
> - Tailwind 与 antd 共存须 `prefix` 或 `ConfigProvider` 双重隔离，避免 utility 与 antd 内联样式冲突
> - Markdown 渲染由项目自建 `<MarkdownRenderer>` 承载 (react-markdown + 插件链)，供 Desktop 与未来 Web 瘦客户端复用
>
> 详见 [05 文档 v4.3 §4 / §6](./05-技术选型文档.md) 与 [08 文档 v3.8 §3.2 / §3.3 / §3.4](./08-技术选型与架构方案(实施版).md)。

### 9.2 核心模块工程结构（前后端分离 v4.1）

> **架构变更说明** (v1.2): 采用**前后端分离**架构。后端是 headless Agent 引擎（纯 Node.js，无 Electron 依赖），前端是多个 thin client（Desktop/TUI/Web/CLI），通过 JSON-RPC 2.0 协议通信。类似 OpenCode（Go 后端 + 多客户端）和 Codex（CLI/App 前端）。详见 [04 文档 v4.1 §4-§6](./04-架构设计文档.md)。

```
OpenWork/
├── apps/                           # 前端客户端（thin clients）
│   ├── desktop/                    # Electron 桌面应用
│   │   ├── main/                   # Electron main (窗口/菜单/托盘 + 后端嵌入)
│   │   │   ├── index.ts
│   │   │   ├── window.ts
│   │   │   ├── tray.ts
│   │   │   ├── menu.ts
│   │   │   ├── ipc/                # Electron IPC 路由
│   │   │   └── backend.ts          # 后端嵌入适配器（嵌入式运行）
│   │   ├── preload/                # contextBridge
│   │   └── renderer/               # React 19 + @lobehub/ui
│   │       ├── index.html
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── components/
│   │       ├── stores/             # Zustand stores
│   │       └── hooks/
│   │
│   ├── tui/                        # Terminal UI (Ink - React for CLI)
│   │   ├── src/
│   │   │   ├── index.tsx           # Ink 入口
│   │   │   ├── App.tsx
│   │   │   ├── components/         # TUI 组件
│   │   │   ├── hooks/
│   │   │   └── client/             # 后端连接（stdio 或 http）
│   │   └── package.json
│   │
│   ├── web/                        # Web 应用（可选，浏览器访问）
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── client/             # WebSocket 连接
│   │   │   └── components/         # 复用 desktop 组件
│   │   └── vite.config.ts
│   │
│   └── cli/                        # CLI (Commander.js)
│       ├── src/
│       │   ├── index.ts
│       │   ├── commands/
│       │   └── client/             # 后端连接
│       └── package.json
│
├── packages/                       # 后端 + 共享包
│   ├── core/                       # 后端核心引擎（纯 Node.js，无 Electron 依赖）
│   │   ├── src/
│   │   │   ├── agent/              # Agent Loop/Prompt/Context/Harness
│   │   │   │   ├── loop/           # PAOR 主循环 + 子循环
│   │   │   │   ├── prompt/         # 七层 Prompt 模型
│   │   │   │   ├── context/        # 上下文引擎
│   │   │   │   ├── harness/        # Harness 工程骨架
│   │   │   │   ├── subagent/       # SubAgent Manager
│   │   │   │   └── coordinator/    # Multi-Agent Coordinator
│   │   │   ├── tools/              # 工具注册与执行
│   │   │   ├── mcp/                # MCP Client
│   │   │   ├── plugins/            # Plugin Sandbox (isolated-vm)
│   │   │   ├── models/             # LLM Provider 抽象
│   │   │   ├── storage/            # SQLite + sqlite-vec + FTS5
│   │   │   ├── indexer/            # web-tree-sitter 索引
│   │   │   ├── memory/             # 记忆系统
│   │   │   ├── security/           # 权限网关 + 审计
│   │   │   ├── skills/             # Skills Runtime
│   │   │   ├── hooks/              # Hooks Runtime
│   │   │   ├── workers/            # Worker Threads (Agent/Tool/Indexer)
│   │   │   └── shared/             # 共享类型与工具
│   │   └── package.json
│   │
│   ├── api/                        # API 契约层（前后端共享）
│   │   ├── src/
│   │   │   ├── protocol.ts         # JSON-RPC 2.0 协议定义
│   │   │   ├── methods.ts          # API 方法签名
│   │   │   ├── events.ts           # 事件类型
│   │   │   └── types.ts            # 共享类型
│   │   └── package.json
│   │
│   ├── server/                     # 后端服务宿主
│   │   ├── src/
│   │   │   ├── runtime.ts          # 后端运行时（嵌入 core）
│   │   │   ├── transports/         # 传输层适配
│   │   │   │   ├── http.ts         # HTTP + SSE (Fastify)
│   │   │   │   ├── websocket.ts    # WebSocket (ws)
│   │   │   │   ├── stdio.ts        # stdio JSON-RPC
│   │   │   │   ├── ipc.ts          # Electron IPC 适配
│   │   │   │   └── embedded.ts     # 嵌入式直接调用
│   │   │   ├── lifecycle.ts        # 服务生命周期
│   │   │   └── index.ts            # 服务入口
│   │   └── package.json
│   │
│   ├── transport-http/             # HTTP transport 客户端（前端用）
│   ├── transport-stdio/            # stdio transport 客户端（前端用）
│   ├── transport-ipc/              # Electron IPC transport 客户端（前端用）
│   │
│   ├── model-providers/            # LLM Provider 实现
│   ├── plugin-sdk/                 # 插件 SDK
│   ├── skills/                     # 内置 Skills
│   ├── prompts/                    # 内置 Prompt 模板
│   ├── hooks/                      # 内置 Hooks
│   │
│   ├── ui-components/              # 共享 React 组件（桌面+web 复用）
│   ├── ui-tui/                     # 共享 TUI 组件（Ink）
│   │
│   ├── config/                     # 配置 schema (Zod)
│   └── types/                      # 共享 TypeScript 类型
│
├── plugins/                        # 内置插件
└── docs/
```

**后端运行模式**：
1. **嵌入式**（默认，桌面/CLI）：直接 import @openwork/core，在同进程内运行，通过 IPC 或 direct call 通信
2. **服务式**：独立 Node.js 进程，监听 HTTP 端口，多客户端共享
3. **子进程式**：CLI/TUI 启动后端子进程，通过 stdio 通信

### 9.3 关键接口契约 (示意)

```typescript
// Agent Core 对外接口
interface AgentEngine {
  run(input: TaskInput, hooks: HookSet): AsyncIterable<Event>;
  pause(): Promise<Checkpoint>;
  resume(cp: Checkpoint): AsyncIterable<Event>;
  step(): Promise<StepResult>;            // 单步
  inspect(): AgentState;                   // 可观测
}

interface Tool {
  meta(): ToolMeta;
  invoke(args: unknown, ctx: Ctx): Promise<ToolResult>;
}

interface Provider {
  chat(req: ChatRequest): AsyncIterable<ChatChunk>;
}
```

### 9.4 可观测性架构

- 统一 Event Bus: 所有模块发事件 (Loop/Tool/Model/IO)。
- 前端订阅渲染,后端持久化到 trace。
- 调试器: 基于事件流构建时间线 + 断点。

### 9.5 测试策略

- 单元: 各引擎纯函数。
- 集成: 引擎组合 + Mock Provider。
- 端到端: 真实模型跑典型任务,断言关键行为 (不追求精确输出,追求流程正确)。
- 回归: Prompt / Skill 变更回归集。
- 性能: 大仓库索引、长会话内存。

### 9.6 发布与打包

- 桌面: electron-builder (nsis/exe/dmg/AppImage/deb/rpm)。
- CLI: npm 全局安装 / npx 单次运行 + brew / scoop / winget 分发。
- 自动更新: electron-updater (stable / beta / nightly 通道)。
- 代码签名: macOS (Developer ID) / Windows (Authenticode) / Linux (GPG)。

---

## 10. 多轮审视与迭代记录

> 本节模拟 PM / CTO / PMO 三轮独立审视,记录发现的问题与决策修订,体现「多轮审视与迭代」。

### 10.1 第一轮审视 — 产品经理 (PM) 视角

**审视重点**: 用户价值、场景覆盖、上手门槛、差异化。

**发现的问题**:
1. **P1-01 上手门槛过高**: §3 暴露的配置项过多,新手会被吓退。
2. **P1-02 缺少「引导式首次体验」**: 没有明确 onboarding。
3. **P1-03 CLI 与桌面关系不清**: 用户何时用哪个?
4. **P1-04 离线场景未覆盖**: 弱网/无网环境如何用?
5. **P1-05 差异化卖点不够锐**: 与 OpenCode / Cline 的区别需一句话讲清。

**修订决策**:
- ✅ 增加「**三层配置暴露**」: 新手 (仅模型 + 风格) / 进阶 (Profile + Skill) / 专家 (全配置)。对应 UI 三档可切换。
- ✅ 增加 **Onboarding Wizard**: 首次启动引导选模型、装 MCP、选 Persona、生成首个 Profile。
- ✅ 明确 **CLI vs Desktop 定位**: CLI = 快速任务 / 远程 / 脚本化;Desktop = 长会话 / 多任务 / 调试 / 团队。
- ✅ 增加 **离线模式**: 本地模型 + 本地索引 + 缓存 Web 文档离线包。
- ✅ 差异化口号: **「看得见、管得住、带得走的 Coding Agent」** (可观测 / 可控 / 可迁移)。

### 10.2 第二轮审视 — 技术总监 (CTO) 视角

**审视重点**: 架构合理性、性能、安全、可维护性、技术风险。

**发现的问题**:
1. **P2-01 Rust + Node 双运行时复杂度高**: 插件需要 Node,但核心 Rust,IPC 边界设计需更明确。（已在 v3.3 迁移至 TypeScript 后解决）
2. **P2-02 Loop 恢复的非确定性**: LLM 非确定性使「时间旅行回放」不可精确复现,需诚实标注。
3. **P2-03 向量索引选型风险**: sqlite-vec 生态尚新,大仓库性能存疑。
4. **P2-04 上下文压缩可能丢关键信息**: 摘要有损,缺乏「信息保全」机制。
5. **P2-05 多 Agent 成本失控风险**: Sub-Agent 并发可能爆炸式烧 token。
6. **P2-06 插件沙箱在桌面端实现成本高**: 真 OS 级沙箱复杂。
7. **P2-07 配置 schema 演进与向后兼容**: 频繁变更会破坏用户 Profile。

**修订决策**:
- ✅ **明确 IPC 边界**: 核心 TypeScript 暴露「能力 API」;插件在 Worker Thread 通过 capability 声明访问;不直接共享内存。
- ✅ **回放诚实模型**: 区分「确定性回放」(工具结果回放) 与「非确定性重放」(LLM 重新生成,标注差异)。
- ✅ **向量索引可插拔 + 默认 embedded + 性能门槛自动切 LanceDB**;提供 benchmark 自检。
- ✅ **信息保全**: 关键事实 (决策/约束) 摘要后必须结构化保留;压缩前后做 diff 校验,关键信息丢失告警。
- ✅ **Sub-Agent 成本治理**: 并发上限 + 子任务预算 + 父任务预算联动;超预算拒绝派生。
- ✅ **沙箱分级**: L1 进程隔离 + 路径白名单 (默认) / L2 容器 (可选) / L3 WASM (实验)。不强求 OS 沙箱。
- ✅ **配置 schema 版本化 + 自动迁移器**: 旧 Profile 自动升级,带 deprecation 期。

### 10.3 第三轮审视 — 项目总监 (PMO) 视角

**审视重点**: 范围控制、交付节奏、风险、开源治理、资源。

**发现的问题**:
1. **P3-01 范围过大,MVP 不可交付**: 一次性做全部功能周期失控。
2. **P3-02 开源治理缺位**: 贡献流程、CLAUDE/CoC、License 兼容性未定。
3. **P3-03 缺乏可度量的成功指标**: 何时算「成功」?
4. **P3-04 文档与教程是短板**: 复杂配置需要强文档。
5. **P3-05 依赖外部模型供应商风险**: 政策变动可能影响可用性。
6. **P3-06 团队协作功能放在远期,但企业用户早期就会问**。

**修订决策**:
- ✅ **分阶段交付 (见 §11)**: MVP 聚焦「单用户桌面 + 核心 Loop + 多模型 + 基础上下文」;扩展与生态放后续。
- ✅ **开源治理**: Apache-2.0;CONTRIBUTING + CLAUDE.md (项目级 Agent 指令) + CoC + DCO 签名。
- ✅ **成功指标**: 周活 / 留存 / 插件数 / MCP 配置数 / 社区 PR / 任务完成率 (用户标记) / 平均成本。
- ✅ **文档优先级提升**: 每个核心能力配教程 + 示例 + 视频脚本;内置交互式教程。
- ✅ **模型供应商去耦**: 多 Provider + 本地模型一等公民,任何单一供应商不可用都不影响产品。
- ✅ **企业特性前置可选**: 审计导出 / 团队 Profile / 私有模型网关 进 v0.3 而非远期。

### 10.4 迭代汇总 (决策变更登记簿)

| ID | 来源 | 变更 | 影响章节 |
|----|------|------|----------|
| C-01 | PM | 三层配置暴露 + Onboarding | §3, §7, §11 |
| C-02 | PM | CLI/Desktop 定位明确 | §1, §9 |
| C-03 | PM | 离线模式 | §3.3, §8 |
| C-04 | CTO | IPC 边界明确 + 沙箱分级 | §2.2, §3.3, §4.2 |
| C-05 | CTO | 回放诚实模型 | §3.4, §5 |
| C-06 | CTO | 向量索引可插拔 + 自检 | §3.2, §5 |
| C-07 | CTO | 信息保全机制 | §3.2 |
| C-08 | CTO | Sub-Agent 成本治理 | §3.4, §3.3 |
| C-09 | CTO | 配置 schema 迁移器 | §5, §7 |
| C-10 | PMO | 分阶段交付 | §11 |
| C-11 | PMO | 开源治理 | §9, §11 |
| C-12 | PMO | 成功指标 | §11 |
| C-13 | PMO | 文档优先级 | §11 |
| C-14 | PMO | 企业特性前置 | §11 |

---

## 11. 里程碑与交付路线

### 11.1 里程碑

| 版本 | 主题 | 核心交付 | 成功指标 |
|------|------|----------|----------|
| v0.1 (MVP) | 核心可用 | 桌面 + CLI;单 Agent PAOR Loop;5 个内置模型 Provider;基础上下文 (文件+Git+选区);内置工具集;权限网关;会话持久化;基础 UI | 能完成典型重构/调试任务,用户留存 > 30% |
| v0.2 | 上下文与可观测 | 代码库索引 + 混合检索;分层摘要;Prompt Inspector;Loop Trace 调试器;成本分析 | 大仓库任务成功率提升,调试可用性 > 4/5 |
| v0.3 | 扩展生态 | MCP 一等公民;自定义工具;Slash Commands;Hooks;Sub-Agent;Skills 系统;插件系统 v1 | 社区贡献插件 > 20, MCP 配置互转可用 |
| v0.4 | 配置化与可迁移 | Profile 系统;导入导出;团队 Profile;主题/快捷键/布局;配置 schema 迁移 | Profile 分享与导入零摩擦 |
| v0.5 | 企业与协作 | 审计导出;私有模型网关;SSO (可选);会话分享;企业沙箱 (容器) | 通过企业安全评审 |
| v1.0 | 稳定与生态 | i18n / a11y 达标;性能优化;自动更新;插件市场;完整文档 | GA 质量,周活稳定增长 |

### 11.2 非功能目标

| 指标 | v0.1 目标 | v1.0 目标 |
|------|-----------|-----------|
| 冷启动 | < 3s (SSD) | < 2s (SSD) |
| 10 万文件首索引 | < 90s | < 60s |
| 空闲内存 | < 400MB | < 300MB |
| 单任务平均成本 | < $0.5 (Sonnet 级) | < $0.3 |
| 安装包大小 | < 80MB (Electron) | < 60MB (Electron) |
| 核心模块测试覆盖 | > 70% | > 80% |

### 11.3 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| 外部模型 API 变更 | 中 | 多 Provider + 适配层 + 本地模型 |
| 向量库性能不达标 | 中 | 可插拔 + benchmark 自检 + 备选 |
| 插件安全 | 高 | 沙箱分级 + 权限声明 + 审计 + 市场审核 |
| 范围蔓延 | 高 | 分阶段 + 严格 MVP 范围 |
| 社区冷启动 | 中 | 兼容竞品格式 + 文档 + 种子插件 |

---

## 附录 A: 术语表

| 术语 | 定义 |
|------|------|
| Agent | 具备感知-行动-反思循环的智能体 |
| Harness | 承载 Agent 运行的工程骨架 (工具/权限/模型抽象/执行) |
| Loop | Agent 的推理-行动循环 |
| PAOR | Perceive-Act-Observe-Reflect,本产品的核心循环 |
| Sub-Agent | 由主 Agent 派生的隔离子智能体 |
| Skill | Prompt + 工具白名单 + 工作流的封装 |
| Hook | 生命周期点的用户脚本钩子 |
| Profile | 一套完整工作环境预设 |
| MCP | Model Context Protocol,工具/资源/Prompt 暴露协议 |
| HITL | Human-In-The-Loop 人工干预 |
| Context Window | 单次推理的 token 预算 |
| RAG | Retrieval-Augmented Generation |
| RRF | Reciprocal Rank Fusion,多路检索融合 |
| Checkpoint | Loop 状态快照,用于恢复 |

## 附录 B: 默认配置清单

(汇总各章默认值,部署时即用,见各章 §x.4)

| 域 | 关键默认 |
|----|----------|
| Prompt | persona=concise; model_adapter=auto; budget=compress-dynamic |
| Context | 混合检索 top_k=10; 摘要 recency=6/chunk=4; facts_extraction=on |
| Harness | permission=approve; sandbox=native; audit=on |
| Model | primary=claude-sonnet-4; fallback=[gpt-4o, qwen2.5-coder]; session_budget=$5 |
| Loop | max_iter=50; reflection=5; HITL=key_nodes; checkpoint=every_step |
| Persistence | SQLite WAL + sqlite-vec + YAML config |
| UI | theme=TokyoNight; layout=focus; keymap=VSCode |

## 附录 C: 数据模型

> 完整数据库 DDL（29 张表）详见 [06-详细设计文档.md](./06-详细设计文档.md) §2.1。

核心表概览：
- 会话域: projects, sessions, messages
- Loop 域: loop_steps, tool_calls, checkpoints
- Agent 域: sub_agents, agent_messages
- 记忆域: memories, memory_vectors, memory_consolidation
- 扩展域: skills, skill_invocations, plugins, plugin_instances, mcp_servers
- Hook 域: hooks, hook_executions
- 权限域: permission_rules, approval_requests
- 配置域: configs, config_history, profiles
- 索引域: code_chunks, index_meta
- 观测域: audit_log, model_calls, events
- 系统域: schema_version

---

> **文档结束**。本设计已通过 PM / CTO / PMO 三轮审视并登记变更 (§10.4)。后续每次重大变更需更新 §10 与版本号。
