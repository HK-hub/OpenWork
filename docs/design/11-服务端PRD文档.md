# OpenWork Server — 服务端产品需求文档 (PRD-Server)

> **文档版本**: v1.0 (Backend-Only PRD — 从 02/04/06 抽离并细化)
> **文档类型**: Product Requirements Document (Server / Backend)
> **审视视角**: 后端架构师 / 高级研发 / QA
> **基线契约**: 统一设计契约 v4.3 (前后端分离 + JSON-RPC 2.0 + 多客户端 + DDD Repository 持久化 + Ant Design v5 + Tailwind v4)
> **关联文档**: [04-架构设计文档.md](./04-架构设计文档.md) v4.3 / [06-详细设计文档.md](./06-详细设计文档.md) v4.3 / [05-技术选型文档.md](./05-技术选型文档.md) v4.3 / [02-PRD产品需求文档.md](./02-PRD产品需求文档.md) v2.4
> **编写日期**: 2026-07-25
>
> **文档定位**: 本文档聚焦 OpenWork **服务端 (`@openwork/core` + `@openwork/server` headless Agent 引擎)** 的功能规格、技术实现方案原理与技术流程，面向后端研发与 QA，是后端编码与测试的直接依据。本文档不涉及任何客户端 (Desktop/TUI/Web/CLI) UI 实现细节；客户端仅作为"经 JSON-RPC Transport 接入的消费者"出现。所有 §N 引用均来自权威文档 (04 架构、06 详设、05 选型)。

---

## 目录

- [0. 文档说明与范围界定](#0-文档说明与范围界定)
- [1. 服务端总体架构与进程模型](#1-服务端总体架构与进程模型)
- [2. PAOR 核心引擎](#2-paor-核心引擎)
- [3. 上下文与知识管理](#3-上下文与知识管理)
- [4. 工具系统与权限网关](#4-工具系统与权限网关)
- [5. MCP 一等公民支持](#5-mcp-一等公民支持)
- [6. AI Provider 抽象与路由](#6-ai-provider-抽象与路由)
- [7. 持久化与 DDD Repository 基础设施](#7-持久化与-ddd-repository-基础设施)
- [8. Event Bus 与事件系统](#8-event-bus-与事件系统)
- [9. 扩展生态 (Hooks / Skills / Plugins / Sub-Agent)](#9-扩展生态-hooks--skills--plugins--sub-agent)
- [10. 目标管理 (GOAL)](#10-目标管理-goal)
- [11. 定时任务与调度 (SCHED)](#11-定时任务与调度-sched)
- [12. 提示词管理 (PROMPT)](#12-提示词管理-prompt)
- [13. Transport 层与 JSON-RPC 服务](#13-transport-层与-json-rpc-服务)
- [14. 安全与合规](#14-安全与合规)
- [15. 可观测性与成本归因](#15-可观测性与成本归因)
- [16. 服务端非功能需求](#16-服务端非功能需求)
- [17. 服务端需求矩阵](#17-服务端需求矩阵)
- [附录 A: 后端包结构目录](#附录-a-后端包结构目录)
- [附录 B: 关键 TS 接口索引](#附录-b-关键-ts-接口索引)
- [附录 C: 数据库 20 表清单与版本节奏](#附录-c-数据库-20-表清单与版本节奏)

---

## 0. 文档说明与范围界定

### 0.1 服务端范围

**本 PRD 范围** = `@openwork/core`(headless Agent 引擎 + 领域层 + 基础设施层) + `@openwork/server`(JSON-RPC 后端宿主 + Transport 层) + `@openwork/ai-sdk`(Provider 抽象层) + `@openwork/api`(类型契约，前后端共享，但本文档从服务端视角描述契约约束)。

**不在范围**：
- 任何客户端 UI 实现 (Desktop/TUI/Web/CLI)
- 桌面框架 (Electron)、终端 (xterm)、代码编辑器 (Monaco)、富文本输入 (TipTap)、Markdown 渲染 (react-markdown) — 均属客户端
- 操作系统的窗口管理、托盘通知等

### 0.2 服务端核心能力清单 (10 大域)

| # | 域 | 一句话职责 |
|---|----|------------|
| D1 | Agent 循环引擎 (PAOR) | 感知→行动→观察→反思的循环驱动 |
| D2 | 上下文工程 | 多源采集、混合检索、分层压缩、三级记忆 |
| D3 | 工具系统 + 权限 | 内置/自定义/MCP 工具统一调度 + 四级权限 |
| D4 | MCP | Model Context Protocol 客户端一等公民 |
| D5 | Provider 抽象 | LLM Provider 注册/适配/路由/Fallback/计价 |
| D6 | 持久化 (DDD Repository) | SQLite + Drizzle + Repository 接口隔离 |
| D7 | Event Bus | 进程内事件总线 + 跨 Transport 事件桥 |
| D8 | 扩展生态 | Hooks / Skills / Plugins / Sub-Agent |
| D9 | GOAL / SCHED / PROMPT | 三大治理能力域 |
| D10 | Transport + RPC | JSON-RPC 2.0 多 Transport 服务暴露 |

---

## 1. 服务端总体架构与进程模型

### 1.1 进程模型 (v4.3)

服务端为 **headless** 形态，无 Electron、无 DOM 依赖，可在三种进程模式下运行：

| 模式 | 进程形态 | DB 句柄持有者 | v0.1 |
|------|----------|---------------|:---:|
| **Embedded (嵌入式)** | 后端嵌入 Electron Main 进程，与前端同进程 | Electron Main | ✅ |
| **Service (服务式)** | 独立 Node 进程，监听 HTTP/WS，文件独占锁 | 独立后端 | v0.2+ |
| **Subprocess (子进程式)** | 经 stdio 与父进程 (CLI/TUI) 通信 | 后端子进程 | v0.2+ |

> **v0.1 锁定**: Embedded + Electron IPC 两种 Transport。HTTP+SSE / WebSocket / stdio / 自定义 SDK 推迟到 v0.2~v3。

### 1.2 9 层分层架构 (后端视角, 04 §3)

```
L1 Presentation (Transport Server)    ── HTTP+SSE/WS/stdio/IPC/Embedded
L2 Application Services               ── 用例编排, 注入 RepositoryProvider
L3 Domain Services                    ── 领域逻辑 (LoopEngine/ToolDispatcher/AIProvider)
L4 Domain Entities                    ── 聚合根类型 (Session/Message/Tool/Goal/...)
L5 Repository Interfaces (domain)     ── Repository<T> + 各聚合仓储接口 (无 SQL)
L6 Transport Contracts (@openwork/api)── JSON-RPC 类型契约, 前后端共享
L7 Repository Implementations (infra) ── Sqlite*Repository + Drizzle ORM
L8 Storage Adapter (infra)            ── better-sqlite3 + sqlite-vec + FTS5 + OS Keychain
L9 Ports (infra)                       ── VectorIndex/FtsIndex/Keychain/FileSystem 接口
```

### 1.3 11 大顶层模块 (06 §3.0 模块映射)

| # | 模块 | 域 | v0.1 |
|---|------|----|:---:|
| 1 | LoopEngine | Agent 循环 | ✅ |
| 2 | ToolDispatcher + Registry | 工具 | ✅ |
| 3 | PermissionGateway | 权限 | ✅ |
| 4 | ProviderRouter + Adapter | LLM | ✅(5 Provider) |
| 5 | MCPClient | 扩展 | ✅ |
| 6 | ContextManager + RAG | 上下文 | ✅基础 |
| 7 | MemorySystem | 记忆 | v0.2 |
| 8 | EventBus | 事件 | ✅ |
| 9 | HookEngine + SkillEngine + PluginSandbox + SubAgentManager | 扩展生态 | v0.2~v3 |
| 10 | SchedulerService | SCHED | v0.4 |
| 11 | GoalService + PromptService + RepositoryProvider (infra) | 治理 / 基础设施 | 详见各域 |

---

## 2. PAOR 核心引擎 (D1)

### 2.1 功能规格

PAOR 循环 = **P**erceive → **A**ct → **O**bserve → **R**eflect，闭环驱动 LLM 决策与工具执行。对应 02 REQ-AGENT-001 [P0] / 04 §7 / 06 §3.1。

#### 2.1.1 阶段职责矩阵

| 阶段 | 职责 | 输入 | 输出 | 持久化 |
|------|------|------|------|--------|
| **Perceive (感知)** | 整合 9 类上下文来源，组装 System Prompt + Context Window | 会话上下文 + 选区 + Git + 诊断 + 历史 | 渲染后的 prompt + token 预算 | loop_steps (phase=perceive) |
| **Act (行动)** | 调用 LLM 决策可选工具调用；并发执行多个独立工具 | LLM 返回的 tool_calls | 各工具的 ToolResult | loop_steps (phase=act) + tool_calls + model_calls |
| **Observe (观察)** | 结构化解析工具输出，写入工作记忆 + Observation | 各 ToolResult | observation message | loop_steps (phase=observe) |
| **Reflect (反思)** | 每 N 轮自评进度，必要时重规划或终止 | 当前 step 累积 + 验收条件 | reflect verdict (continue/replan/done/abort) | loop_steps (phase=reflect) |

#### 2.1.2 终止条件 (REQ-AGENT-001 验收)

1. 任务完成 (LLM 输出 `task_complete` 信号)
2. 达到 `loop.max_iterations` (默认 25)
3. 用户主动停止 (`/stop` / ESC)
4. 成本超限 (`budget.session_cost_exceeded`)
5. 不可恢复错误 (连续 K 次 `act` 失败)

### 2.2 子循环系统 (5 个)

| 子循环 | 触发 | v0.1 | 详见 |
|--------|------|:---:|------|
| **Planning Loop** | 预计步数 > `planning.auto_plan_threshold` (默认 3) | ✅ | REQ-AGENT-002 |
| **Execution Loop** | DAG 子任务串行/并行 | v0.2 (Sub-Agent 阶段) | REQ-AGENT-006 |
| **Verification Loop** | 代码改动后自动跑测试/Lint/类型检查 | v0.2 | REQ-AGENT-009 |
| **Reflection Loop** | 每 N 轮或阶段完成 | ✅(简化版) | REQ-AGENT-001 |
| **Recovery Loop** | 工具/测试失败自动重试 (max_retries 默认 3) | v0.2 | REQ-AGENT-008 |

### 2.3 任务编排 (DAG, 04 §7)

- 任务分解为有向无环图 (DAG)；节点 = 子任务，边 = 依赖
- 无依赖节点可并行派发 Sub-Agent
- 进度可视化通过 LoopStep 持久化给前端回放
- 结果聚合策略: `merge / latest / manual_arbitration`

### 2.4 循环控制与干预 (HITL)

| 能力 | 说明 | v0.1 |
|------|------|:---:|
| 暂停/恢复 | 任意点暂停，状态存 checkpoint；恢复时重新组装上下文 | v0.2 |
| 时间旅行 | 回退历史某步重放 (确定性 + 非确定性标注) | v0.2 |
| HITL 三档 | every_step / key_nodes / trust | v0.1(key_nodes 默认) |
| 干预动作 | 批准 / 修改 / 拒绝 / 接管 | ✅ |

### 2.5 技术实现原理

**LoopEngine 驱动** (06 §3.1)：

```
while (!terminated) {
  const ctx = await perceive(state);      // L1: ContextManager 组装 + token 预算
  const resp = await act(ctx);             // L1: AIProvider.chatStream() + ParallelToolDispatcher
  const obs = observe(resp.toolResults);    // L2: 结构化写入 working memory
  const verdict = reflect();               // L2: 自评，必要时 replan
  state = apply(state, obs, verdict);
  await persist(loopStep);                 // 经 RepositoryProvider.loopStep.create
  await emit('agent.event', state);
  await runPostHooks(state);               // 生命周期 Hook 触发
}
```

- **并发工具执行**: LLM 在一次回复声明多个 tool_calls → ToolDispatcher 识别无依赖关系 → 并发执行 (默认上限 4)，结果合并回流
- **流式**: `AIProvider.chatStream()` 返回 `AsyncIterable<ChatChunk>`，每 chunk 经 Transport 推 `agent.event` (token-level)
- **崩溃恢复**: checkpoint 持久化 → 启动时检测 last checkpoint → resume；token 不丢失 (04 §4.5)

### 2.6 技术流程 (时序, 一次完整 PAOR 步)

```
Client ─ agent.run(req) ─► Server
  ├─ LoopEngine.run(sessionId, userMsg)
  │    1. ContextManager.assemble(state) ──► LubedPromized prompt (token 预算)
  │    2. PromptRenderer.render(template, vars) ──► final prompt
  │    3. ProviderRouter.route(task, capability) ──► AIProviderAdapter
  │    4. AIProvider.chatStream(req) ►─token─►─►─► EventBus('agent.event')
  │    5. [tool_calls?]
  │         └─ ToolDispatcher.dispatch(tool_calls, parallel_max=4)
  │              ├─ PermissionGateway.check(tool, args) ──► approve/deny (经 audit_log)
  │              ├─ PluginSandbox.execute(expected with isolation)
  │              └─ ObservationCollector.collect(results)
  │    6. Reflect.evaluate(state) ──► verdict (continue/replan/done)
  │    7. RepositoryProvider.withTx(async tx => {
  │         await loopStep.create(step, tx);
  │         await toolCall.bulkCreate(tool_calls, tx);
  │         await modelCall.create(token/cost, tx);
  │         await checkpoint.upsert(state, tx);
  │       });
  │    8. runPostActHooks(state) // pre_act / post_observe 钩子
  │    9. [terminated?] ─► emit('agent.completed'); break
  └─ 流式 'agent.event' 透传至 Client
Client ◄─ stream ─ Server
```

---

## 3. 上下文与知识管理 (D2)

### 3.1 功能规格 (02 REQ-CTX-001~008)

| 子功能 | 描述 | v0.1 |
|--------|------|:---:|
| 9 类上下文来源 | 显式 / 文件 / 代码库索引 / Git / 终端 / 编辑器 / 浏览器 / 项目配置 / 会话历史 | v0.1 基础 4 类 (显式/文件/Git/会话) |
| 采集权重 | 每来源可配置 weight + enable/disable | v0.1 简化 |
| 上下文压缩 | 分层摘要 (近因原样 / 摘要窗口 / 事实 KV) + Token 预算管理 | v0.1 简单截断；v0.2 完整 |
| 混合检索 (RAG) | 语义 (向量) + 关键词 (BM25/FTS5) + 结构 (符号图) + RRF 融合 | v0.2 |
| 记忆系统 | 工作记忆 / 项目记忆 / 全局记忆 (三级) | v0.2 |
| Token 仪表盘数据 | 经事件流提供给前端 | v0.1 |
| 上下文钉选/驱逐 | LRU + 重要度；驱逐日志 | v0.2 |

### 3.2 上下文压缩分层 (06 §3.x)

```
┌──────────── 近因窗口 (原样保留) ────────────┐
│  最近 N 轮消息 + 当前 token 预算内           │
├──────────── 摘要窗口 (压缩) ─────────────────┤
│  中等时段 → LLM 生成结构化摘要               │
├──────────── 事实窗口 (KV 结构化) ─────────────┤
│  远期 → 关键事实 KV (decision/fact/constraint)│
└─────────────────────────────────────────────┘
```

- Token 预算 = `model.window - 输出预留 - 工具预留 - 动态预留`
- 压缩策略: `compress-dynamic / truncate-tail / summarize-all / drop-low-weight`
- 关键事实 (决策/约束) 压缩后结构化保留，避免关键信息丢失；压缩前后 diff 校验产生告警

### 3.3 混合 RAG 检索 (v0.2)

| 通道 | 引擎 | DTO |
|------|------|-----|
| 语义 | sqlite-vec (VectorIndexPort) | `searchVec(table, queryVec, topK)` |
| 关键词 | FTS5 + trigram tokenizer (FtsIndexPort) | `searchText(table, query, topK)` |
| 结构 | 符号图 / 引用图 / 调用链 (TreeSitter 产物) | `findSymbol / findReferences / findCallers` |
| 融合 | RRF (Reciprocal Rank Fusion) | `fuse(semantic[], keyword[], structural[])` |

- 显式触发: `@symbol` 在用户消息中
- 隐式触发: LLM 主动调用 `search_codebase` 工具

### 3.4 记忆系统 (三级, 02 REQ-CTX-005)

| 级别 | 范围 | 生命周期 | 写入入口 | 持久化 |
|------|------|----------|----------|--------|
| 工作记忆 | 当前会话 | 会话结束 (可转存) | Agent Loop 自动 | in-memory + checkpoints |
| 项目记忆 | 当前项目 | 持久 | Agent `memory_write` 工具 / Hooks | memories 表 (scope=project) |
| 全局记忆 | 跨项目 | 持久 | 同上 / Onboarding | memories 表 (scope=global) |

- 记忆分类: `decision / fact / preference / lesson / todo`
- 记忆可搜索、可编辑、可"遗忘" (`memory_forget`)
- 关联到目标 (Goal) 后可在跨会话续作时恢复 (见 §10)

### 3.5 技术实现原理

**ContextManager** (06 §3.x):
1. **采集层**: 各 ContextSource 单例 (`FileContext`, `GitContext`, `LSPContext` 等) 实现 `ContextSource` 接口；按权重 emit `ContextFragment`
2. **预算层**: Token 预算分配器按"近因 70% / 摘要 20% / 事实 10%"切分 (可配置)
3. **渲染层**: PromptRenderer (Handlebars) 按七层洋葱模型渲染最终 prompt
4. **驱逐层**: 按重要度 (相关性 × 时效性 × 用户钉选标记) 排序，超预算则按 LRU + 重要度驱逐

---

## 4. 工具系统与权限网关 (D3)

### 4.1 内置工具集 (18+ 工具, 02 REQ-TOOL-001)

| 工具 | 能力 | 风险等级 | v0.1 |
|------|------|:---:|:---:|
| `read_file` | 读文件 (含行范围) | L0 | ✅ |
| `write_file` | 写 (新建/覆盖) | L1 | ✅ |
| `edit_file` | 精确字符串替换 / 多点编辑 | L1 | ✅ |
| `delete_file` | 删除文件 | L2 | ✅ |
| `move_file` | 移动/重命名 | L1 | ✅ |
| `glob` | 文件名模式匹配 | L0 | ✅ |
| `grep` | 内容正则搜索 (ripgrep) | L0 | ✅ |
| `search_codebase` | 语义搜索 | L0 | v0.2 |
| `run_command` | 执行终端命令 | L2 | ✅ |
| `run_background` | 后台长任务 | L1 | v0.2 |
| `editor_action` / `diagnostics` | 编辑器联动 / LSP | L0 | v0.2 |
| `browser_*` | 导航/点击/截图/抓取 | L1 | v0.3 |
| `web_search` / `web_fetch` | 联网搜索 / 抓取 | L1 | v0.2 |
| `memory_read` / `memory_write` | 记忆读写 | L0 | v0.2 |
| `todo_write` | 任务清单 | L0 | ✅ |
| `task_spawn` | 派生 Sub-Agent | L1 | v0.3 |
| `mcp_call` | 调用 MCP 工具 | 继承 | ✅ |
| `skill_invoke` | 调用 Skill | 继承 | v0.3 |
| `goal_decompose` / `goal.update` | 目标工具 (见 §10) | L1 | v0.3 |

### 4.2 工具执行流程 (06 §3.2)

```
LLM ── tool_X(args) ──► ToolDispatcher
  │
  ├─ 1. [Permission Gateway] 校验权限 (L0-L3)
  │      ├─ L0 自动允许  L1 可配置  L2 默认需确认  L3 永远确认+审计
  │      └─ ApprovalCache 命中 → skip；否则触发 `tool.approval_needed` 事件 → 客户端确认
  │
  ├─ 2. [Tool Dispatcher] 路由到对应 Worker
  │      ├─ 内置工具 → Agent Worker (Worker Threads)
  │      ├─ 自定义工具 → Plugin Sandbox (isolated-vm)
  │      └─ MCP 工具 → MCP Client → 外部 stdio/SSE/HTTP
  │
  ├─ 3. [Sandbox] 受限环境执行
  │      ├─ 文件操作限制在项目根 + 白名单 (FileSystemPort)
  │      ├─ 命令 allowlist + blocklist (CommandFilter)
  │      └─ 网络域名白名单 (DomainFilter)
  │
  ├─ 4. [Audit] 记录到 audit_log (append-only)
  │      ├─ time / actor / toolName / args-summary / result-summary / approved / duration
  │      └─ L3 强制签名防篡改 (可选, 02 REQ-SEC-003)
  │
  └─ 5. 回流 → Observation 写入工作记忆
```

### 4.3 权限分级 (02 REQ-TOOL-002)

| 级别 | 行为 | 默认策略 | 示例 |
|:----:|------|----------|------|
| L0 | 只读 | 自动允许 | read/grep/glob |
| L1 | 变更 | 可配置 (auto/approve/deny) | write/edit |
| L2 | 破坏性 | 默认需确认 | delete/run_command |
| L3 | 关键 | 永远确认 + 不可擦除审计 | rm -rf / sudo / force push |

**确认机制** (审批缓存):
- 单倍批准粒度: `once / session / project / permanent`
- 危险操作 dry-run 预览 (如 `edit_file` 显示 diff)
- 审批粒度可配置 TTL；过期重新确认

### 4.4 自定义工具注册 (02 REQ-TOOL-006, v0.3)

- 用户可编写 `TS / Python / Shell` 脚本定义工具
- 声明: JSON Schema 入参/出参 + 风险等级 + 超时 + 是否流式
- 进入同一 `ToolRegistry`，统一权限审计
- 支持版本化 + 热重载 (脚手架生成与加载由 Plugin SDK 承担)

---

## 5. MCP 一等公民支持 (D4)

### 5.1 功能规格 (02 REQ-EXT-001 [P0])

| 子功能 | 描述 | v0.1 |
|--------|------|:---:|
| Transport | stdio / SSE / HTTP 三种 | ✅(stdio v0.1, HTTP/SSE v0.2) |
| UI 化管理 | (后端拒收;客户端发起) 配置写 `mcp_servers` 表 | ✅ |
| 配置存储 | DB 化 (`mcp_servers` 表) | ✅ |
| 健康检查 | 周期 ping + 自动重连 (backoff) | ✅ |
| 工具合并 | MCP 工具与内置工具统一进入 `ToolRegistry` | ✅ |
| Resources + Prompts 消费 | 支持订阅/拉取 | v0.2 |
| 错误隔离 | MCP Server 崩溃不影响主进程 (子进程隔离) | ✅ |

### 5.2 技术实现原理

**MCPClient** (06 §3.x):
- 进程隔离: 每个 stdio MCP Server 单独 child_process；SSE/HTTP 单独 HTTP 客户端
- 心跳: 30s ping → 时间窗口内失败标记 `status=failed`，触发重连 (exponential backoff: 1s → 30s 上限)
- 协议协商: 启动时 `initialize` 握手协商协议版本，不兼容降级 (避免 v4 协议变更导致 crash)
- 工具清单合并: MCP `tools/list` → register to `ToolRegistry` 命名空间 `mcp.{serverName}.{toolName}`
- 调用透传: `mcp_call(serverName, toolName, args)` → MCP `tools/call` → 结果标准化为 `ToolResult` 回流 Loop

### 5.3 错误隔离策略

| 故障 | 影响 | 隔离机制 |
|------|------|----------|
| MCP Server crash | 该 Server 工具不可用 | 子进程 crash → 监听器触发重启；不影响 Loop 当前步 |
| MCP 协议超时 | 工具调用挂起 | 调用超时 (默认 30s) → Recovery Loop 接管 |
| 工具异常 | 结果异常 | 异常序列化到 `ToolResult.error` 而非抛出 Loop；Loop 经 Observe 阶段喂回 LLM 决策 |

---

## 6. AI Provider 抽象与路由 (D5)

### 6.1 功能规格 (02 REQ-TOOL-004 [P0] + REQ-PROVIDER-001~004)

| 子功能 | 描述 | v0.1 |
|--------|------|:---:|
| 5 Provider 落地 | OpenAI / Anthropic / Google (Gemini) / Ollama / 任意 OpenAI 兼容 | ✅ |
| 全量 Adapter | Azure/Bedrock/Mistral/Cohere/DeepSeek/Grok/OpenRouter/llama.cpp/vLLM/LM Studio | v0.2+ |
| 统一接口 | `chat(messages, tools, config) -> stream<chunk>` | ✅ |
| 自动适配 | 流式协议 / 工具调用协议 / 系统消息位置 / stop 序列 / token 计数 | ✅ |
| 模型路由 | 按任务类型 / 成本 / 延迟 / 能力位自动选择 | v0.2 |
| Fallback | 主模型失败自动切换 fallback 链；Ollama 兜底 | ✅ |
| 成本控制 | 会话级 + 日级 + 项目级预算 | ✅ |
| 自定义接入 SDK | 企业自建 Adapter npm 包注入 | v0.3 |

### 6.2 Adapter 契约 (06 §3.17.2)

```typescript
export interface AIProviderAdapter {
  readonly id: string;
  readonly kind: 'openai' | 'anthropic' | 'google' | 'ollama' | 'azure' | 'bedrock' | 'mistral' | 'cohere' | 'deepseek' | 'grok' | 'openrouter' | 'custom';
  readonly capabilities: ProviderCapability;
  readonly models: ModelSpec[];
  chat(req: ChatRequest): Promise<ChatResponse>;
  chatStream(req: ChatRequest): AsyncIterable<ChatChunk>;
  embed?(req: EmbedRequest): Promise<EmbedResponse>;
  countTokens(text: string, model: string): number;
  estimateCost(usage: TokenUsage, model: string): number;
  healthCheck(): Promise<HealthStatus>;
}

export type ProviderCapability = {
  streaming?: boolean;
  tool_call?: boolean;
  vision?: boolean;
  json_mode?: boolean;
  parallel_tool?: boolean;
  prompt_caching?: boolean;
  thinking?: boolean;
  system_as_role?: boolean;     // Anthropic=true; OpenAI 兼容=false (system message)
};
```

### 6.3 能力位协商原理

- 启动时各 Adapter 自行声明 capability mask
- 运行时 Router 拒绝不满足能力位的 Provider；缺失能力走 polyfill:
  - 缺 `parallel_tool` → Router 拆多次顺序调用
  - 缺 `tool_call` → 经"提示词式工具调用"降级 (FunctionCallingPromptAdapter)
  - 缺 `system_as_role` → 转 system message to user message
- 显示能力差异经 `CapabilitiesInspector` 检防远比健康检查错误更深的报错 (Anthropic system-as-role vs OpenAI system-message)

### 6.4 路由与 Fallback 算法 (04 §10)

**ProviderRouter**:
```
route(taskKind, capabilityRequired, budgetWeight):
  candidates = registry.filter(p => p.enabled && p.health && (p.cap & capabilityRequired) == capabilityRequired)
  candidates.sort(by configured priority, then by cost-per-1M-tokens, then by avg latency)
  return candidates[0]

fallbackChain(providerId):
  chain = providersTable.fallback_chain where id = providerId
  return chain or [primary, secondary, ..., ollama-local-fallback]
```

**健康检查**:
- `healthCheck()` 每 N 分钟 (默认 5min) 调用;失败 3 次置 `status=unhealthy` → 自动切到Fallback

### 6.5 计价与成本归因

- 内置 `pricing-table.json` 维护主流模型 $/Mtok
- 自定义 Provider 可声明 `estimateCost(usage, model)`
- 每次模型调用写入 `model_calls` 表 (`provider/model/input_tokens/output_tokens/cost/created_at`)
- 成本归属到调用链路: 当前 session_id + loop_step_id；Sub-Agent 调用归属父任务

### 6.6 自定义接入流程 (v0.3)

```
1. 企业编写 npm 包 my-gateway-adapter:
   class MyAdapter extends BaseAdapter { chat() {...} chatStream() {...} }
2. 发包 / 本地依赖
3. 启动 Plugin 加载: my-adapter-plugin 在 register() 调用 aiSdk.registry.register(new MyAdapter(...))
4. Registry 检测冲突 (重复 id) → 报错 or 升版
5. Router 立即可选，享受与内置同等的 cost / 审计 / Fallback 待遇
```

---

## 7. 持久化与 DDD Repository 基础设施 (D6)

### 7.1 核心约束 (QoS: 业务零 SQL)

1. **接口位置**: `Repository<T>` 泛型接口位于 `packages/core/src/domain/repository.ts`，所有聚合仓储接口位于 `domain/repositories/`
2. **禁止 SQL 耦合**: domain 层禁止 `import 'better-sqlite3'` / SQL 字符串 / 驱动类型
3. **实现位置**: SQLite 实现位于 `infra/db/sqlite/Sqlite*Repository.ts` (+ Drizzle ORM)
4. **事务统一入口**: `RepositoryProvider.withTx(work)` 唯一事务边界
5. **查询构造**: `findAll(filter?: RepositoryQuery<T>)` 接收声明式 where/orderBy/limit/offset；复杂查询由各仓储特化方法承担
6. **索引独立访问**: vectors 与 FTS5 经 `VectorIndexPort` / `FtsIndexPort` 接口暴露
7. **审计与软删除可插拔**: Infrastructure 层装饰器 / 拦截器，业务接口保持纯净
8. **可替换实现**: `RemoteHttpRepositoryProvider` (Service 模式 + 远程 DB) / `PostgresRepositoryProvider` (远程 PG) 与 Sqlite 实现同接口，业务零修改

### 7.2 DDD 分层落位 (04 §11.9)

```
┌──────────────────────────────────────────────────────────┐
│ Domain Layer        │ packages/core/src/domain/          │
│ (接口，纯 TS)        │  ├── entity/    (聚合根: Session…)  │
│ 业务模块仅依赖接口  │  ├── repository.ts (Repository<T>) │
│                     │  └── repositories/ (各仓储接口)    │
├──────────────────────────────────────────────────────────┤
│ Application Layer   │ packages/core/src/application/     │
│ 用例编排 / 事务边界 │  依赖 RepositoryProvider 注入接口  │
├──────────────────────────────────────────────────────────┤
│ Infrastructure      │ packages/core/src/infra/db/        │
│ (实现，驱动耦合)    │  ├── sqlite/  (better-sqlite3 实现)│
│                     │  ├── drizzle/ (查询构造，可选)    │
│                     │  └── RepositoryProvider.ts        │
└──────────────────────────────────────────────────────────┘
```

### 7.3 RepositoryProvider 仓储清单 (20 聚合, 06 §2.8 / 04 §16.10)

#### v0.1 落地 (12 仓储)
`SessionRepository / MessageRepository / ToolCallRepository / LoopStepRepository / ConfigRepository / ConfigHistoryRepository / McpServerRepository / ProfileRepository / AuditLogRepository / ModelCallRepository / CheckpointRepository / ProviderRepository`

#### v0.2+ 扩展 (8 仓储)
`MemoryRepository / HookRepository / SkillRepository / SubAgentRepository / CommandRepository / IndexMetaRepository`

#### v0.3+ v4.3 新增 (4 仓储)
`GoalRepository / ScheduledTaskRepository / ScheduledTaskRunRepository / PromptTemplateRepository`

合计 = 24 仓储 (隅合 20 张表 + 子表)。完整接口见 04 §16.10.2。

### 7.4 泛型基契约 (04 §16.10.1)

```typescript
export interface Repository<T, ID = string> {
  findById(id: ID, tx?: Transaction): Promise<T | null>;
  findAll(filter?: RepositoryQuery<T>, opts?: FindOptions): Promise<Page<T>>;
  create(entity: Omit<T, 'id'>, tx?: Transaction): Promise<T>;
  update(id: ID, patch: Partial<T>, tx?: Transaction): Promise<T>;
  delete(id: ID, tx?: Transaction): Promise<void>;
  bulkCreate(entities: Omit<T, 'id'>[], tx?: Transaction): Promise<T[]>;
  upsert(entity: Partial<T> & { id?: ID }, tx?: Transaction): Promise<T>;
  count(filter?: RepositoryQuery<T>, tx?: Transaction): Promise<number>;
  exists(filter: RepositoryQuery<T>, tx?: Transaction): Promise<boolean>;
  softDelete?(id: ID, tx?: Transaction): Promise<void>;
  restore?(id: ID, tx?: Transaction): Promise<void>;
}
```

### 7.5 SqliteRepositoryProvider 实现示意

```typescript
class SqliteRepositoryProvider implements RepositoryProvider {
  readonly session: SessionRepository;
  readonly message: MessageRepository;
  // ... 20 个聚合仓储

  private db: BetterSQLite3Database;
  constructor(dbPath: string) {
    const sqlite = new Database(dbPath, { fileMustExist: true });
    sqlite.pragma('journal_mode = WAL');
    this.db = drizzle(sqlite, { schema });
    this.session = new SqliteSessionRepository(this.db);
    // ...
  }

  async withTx<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(async (drizzleTx) => work(wrapDrizzleTx(drizzleTx)));
  }
}
```

### 7.6 Drizzle ORM schema 与迁移 (06 §2.8)

- Drizzle schema 为单一真相源 (`infra/db/drizzle/schema.ts`，与 §2.1 物理 DDL 必须一致)
- `drizzle-kit generate:sqlite` 生成 SQL 迁移至 `infra/migrations/`
- **启动时自动迁移** (02 REQ-DATA-005): 比对 `schema_version` 表 → 按版本顺序执行 → 写入版本记录
- **迁移前自动备份** SQLite 文件 (`.bak` 后缀) → 失败可回滚
- CI 强制 Drizzle schema ↔ 物理 DDL 比对 (避免手写 SQL 漂移)

### 7.7 多客户端与 CS 分离协同 (06 §2.8.7)

- 后端唯一持有 `RepositoryProvider` 实例 (Sqlite / Remote 实现)
- 客户端经 `@openwork/api` JSON-RPC 不持有 Repository 句柄
- Service Facade 内部调 Repository (经过 RPC 方法)
- 服务式模式只读副本：`FindOptions.readOnly` 标记 → Service 层分流到只读 RepositoryProvider
- 远程 DB 切换: 实现 `RemoteHttpRepositoryProvider` (走 §13 HTTP Transport) 即可，业务与客户端零修改

---

## 8. Event Bus 与事件系统 (D7)

### 8.1 功能规格 (06 §3.x / §4.3)

- 后端 EventBus 进程内同步派发 listener (HITL、审计、Memory 落库、Hook 触发)
- 跨 Transport 事件推送: 后端 EventBus 触发的事件经 `EventBridge` 序列化为 JSON-RPC notification，经 Transport 推送已订阅客户端
- 可靠性: 尽力推送 + 客户端补偿；非关键事件丢失可容忍；关键事件 (如 `tool.approval_needed`) 由客户端经 `agent.inspect` 主动补偿查询
- 背压: 高频事件 (如 `agent.event` token 流) 由后端 ring buffer 缓冲，满则按策略丢弃旧值或合并

### 8.2 事件清单 (06 §4.3, 订阅型)

| 事件 | 触发 | 携带数据 | 推送 Transport |
|------|------|----------|:---:|
| `agent.event` | Loop 每步 / token 流 | step / token / diff | ✅ |
| `agent.completed` | Loop 终止 | summary / cost | ✅ |
| `agent.stopped` | 用户停止 | reason | ✅ |
| `tool.approval_needed` | L2/L3 待确认 | tool_call | ✅ |
| `tool.executed` | 工具完成 | result | ✅ |
| `context.pinned` / `context.evicted` | 上下文变化 | item | v0.2 |
| `goal.progress_updated` | 目标自评 | goal_id / progress | v0.3 |
| `scheduler.run.completed` / `.failed` | 定时任务 Run | run_id | v0.4 |
| `prompt.template.changed` | 模板热加载 | template_id | v0.2 |
| `hook.executed` | Hook 完成 | hook_id / result | v0.2 |
| `mcp.health_changed` | MCP 健康 | server_id / status | ✅ |

### 8.3 事件补发协议 (since 游标, 06 §4.3)

- 客户端订阅时携带 `since` (event_id)
- 后端查询 `events WHERE id > since` 推送补发
- 消息 ID 幂等性: 客户端按 `event_id` 去重

### 8.4 技术实现原理

- EventBus: 简化 EventEmitter2 子集 (避免依赖)；支持 `on` / `once` / `off` / `emit`
- 单线程同步派发 (避免竞态)；异步 listener 经 `setImmediate` 排队执行
- `EventBridge`: 订阅所有事件 → 序列化 → 经 Transport (HTTP/SSE/WebSocket/IPC) 推送订阅者
- Ring Buffer: token 流 `agent.event` 使用 16KB Ring Buffer，溢出按 `event_overload_policy` 处理 (`drop_oldest | coalesce | pause`)

---

## 9. 扩展生态 (D8)

### 9.1 扩展通道总览 (01 §4.7, v0.2~v3)

| 通道 | 改变什么 | 形态 | 沙箱 |
|------|----------|------|:---:|
| MCP | 工具/资源/Prompt | 外部进程 | ✅(子进程) |
| 插件 | 工具/命令/UI/Hook/Persona | 代码包(npm/WASM/本地目录) | ✅(isolated-vm) |
| 自定义工具 | 工具 | 脚本 (TS/Python/Shell) | ✅ |
| Slash Command | Prompt/工作流 | Markdown/脚本 | — |
| Sub-Agent | Persona/工具白名单 | 配置 (sub_agents 表) | 继承父 Agent |
| Hooks | 生命周期行为 | 脚本 | ✅ |
| Skills | Prompt/工作流 | YAML + 脚本 | — |

### 9.2 Hooks 系统 (02 REQ-EXT-002, v0.2)

#### 9.2.1 Hook 点 (13+)
```
on_session_start  pre_plan  post_plan  pre_act  post_observe
on_tool_call  on_tool_result  on_file_change  on_test_fail
on_task_complete  pre_model_call  post_model_call  on_cost_warning  on_session_end
```

- `pre_*` 可拦截 / 改写请求
- `post_*` 可改写结果
- Hook 失败不中断主循环 (可配置 `failure_policy`)
- Hook 配置存储在 `hooks` 表 (DB 化)

#### 9.2.2 执行流程 (HookEngine, 06 §3.x)
```
1. LoopEngine 在 phase 切换时 EventBus.emit('hook.pre_act', ctx)
2. HookEngine 按优先级取 hooks.pre_act → 经 PluginSandbox 执行
3. 收集 HookResponse { allow? , rewrite? , inject? }
4. 合并到 ctx 后再继续 Loop
5. post hooks 同流程但改写结果
```

### 9.3 Skills 系统 (02 REQ-EXT-003, v0.3)

- Skill = 可复用 (Prompt + 工具白名单 + 工作流 + 可选脚本) 封装
- 内置 20+ Skill (TDD/commit/PR/code-review/debug/refactor/scaffold/docs/migration/security-audit 等)
- Skill 声明前置依赖 (如需要某 MCP Server)
- 可被命令 / 快捷键 / Agent 自动 (基于意图识别) 调用
- 配置存储在 `skills` 表

### 9.4 插件系统 (02 REQ-EXT-004, v0.3)

- 形态: npm 包 / 本地目录 / WASM 模块
- 能力: 注册 工具 / 命令 / Skills / Hooks / UI 面板 (服务端只暴露 RPC 元数据，UI 由前端实现) / 设置项 / Persona
- 拦截器: Loop 各阶段注入逻辑
- 沙箱: 隔离 Worker (isolated-vm) + 权限声明
- 生命周期: install → enable → configure → run → disable → uninstall
- 沙箱资源限制 (06 §3.10): CPU 时间 / 内存 / 调用次数 / 网络白名单 / 文件系统隔离 (可配置)
- SDK: 自研 TypeScript SDK (`@openwork/plugin-sdk`)

### 9.5 Sub-Agent 与 Multi-Agent (02 REQ-AGENT-006/007, v0.3)

#### 9.5.1 三种协作模式
- **主从模式**: 主 Agent 派生 Sub-Agent 处理子任务
- **并行模式**: 多 Sub-Agent 并行处理独立子任务 (依赖 DAG 决定并行度)
- **专家模式**: 不同 Sub-Agent 装载不同 Persona/Skills 子集

#### 9.5.2 上下文与成本策略 (04 §8.2)
- **上下文隔离**: Sub-Agent 不直接共享父 Agent 上下文；经结构化消息 (NotebookProtocol) 通信
- **成本归属**: Sub-Agent 成本归属父任务 (model_calls.session_id = 子 session，parent_session_id = 父)
- **预算联动**: Sub-Agent 预算上限不超过父剩余预算
- **循环依赖打破**: Sub-Agent 也能调用 `task_spawn` (限制深度 `subagent.max_depth`，默认 3)

---

## 10. 目标管理 GOAL (D9-GOAL, v0.3 启用)

### 10.1 功能规格 (02 REQ-GOAL-001~005)

| 功能 | 描述 | 影响表 |
|------|------|--------|
| Goal 实体 | 标题 + 描述 + 验收标准 + 父子链 + 时间窗 + 进度 + 关联实体 + 上下文锚点 | goals |
| 目标分解 | Agent 调用 `goal_decompose(goal_id, depth)` 产出子目标 + 验收标准 | goals(parent_id) |
| 跨会话续作 | 启动会话时检测 active goals，注入 context_snapshot 恢复上下文 | goals.context_snapshot |
| 进度自评 | Reflect Loop 触发评估，对照 acceptance_criteria 自评分数与达成 | goals.progress |
| 升级与通知 | 连续 K 次自评无进展 → 升级为人工介入 + 系统通知 + hooks | goal.status=blocked |
| 关联实体绑定 | session_id / memory_id / scheduled_task_id / GitHub issue 关联 | goals.linked_*_ids |
| 里程碑与回溯 | milestone 标记 + 回溯某 goal 全部会话与变更 | goals.milestone |

### 10.2 Goal 实体结构

字段: `id / title / description / acceptance_criteria(JSON) / parent_id / status / priority / time_window(JSON) / progress(JSON) / linked_session_ids(JSON) / linked_memory_ids(JSON) / milestone(bool) / context_snapshot(blob) / created_at / updated_at`

status: `backlog / active / blocked / done / abandoned`

### 10.3 跨会话续作算法 (06 §3.15)

```typescript
async resumeActiveGoals(sessionId: string) {
  const active = await goalRepo.findActive();
  for (const g of active) {
    const snapshot = g.context_snapshot; // 缓存 JSON
    await contextManager.inject(g.snapshot); // 注入工作上下文
    await sessionRepo.linkGoal(sessionId, g.id);
  }
}
```

### 10.4 进度自评流程 (Reflect Loop 触发)

1. 取关联 session_ids 与 loop_steps
2. 调用 LLM 对照 `acceptance_criteria` 自评分数 + 状态
3. 更新 `goals.progress` (score / acceptance_pass_count / acceptance_total / last_evaluated_at)
4. 连续 K 次无进展 → `goal.blocked` 事件触发通知 + Hooks (`on_goal_blocked` 可定制)

### 10.5 goal_decompose 工具契约

```json
{
  "name": "goal_decompose",
  "description": "将目标分解为子目标 + 验收标准",
  "inputSchema": { "goal_id": "string", "depth": "int" },
  "returns": [{ "sub_goal": { "title": "...", "acceptance_criteria": ["..."] } }]
}
```

---

## 11. 定时任务与调度 SCHED (D9-SCHED, v0.4 启用)

### 11.1 功能规格 (02 REQ-SCHED-001~004)

#### 11.1.1 调度形态

| 形态 | 触发 | 示例 |
|------|------|------|
| **cron** | cron 表达式 (5/6/7 段) | 每周六 02:00 全项目 Lint+测试 |
| **interval** | 间隔秒数 | 每小时依赖安全告警 |
| **event** | 事件 (on_commit/on_idle/on_cost_warn) | commit 后自动审查 |
| **once** | 延迟到指定时刻运行一次 | 发布窗口生成发版说明 |

#### 11.1.2 任务定义要素
- 任务名称 / 描述 / 启用开关
- 调度表达式
- 绑定 Persona + Skills + MCP 子集 (复用 Profile)
- IO 模式: `silent` / `notify` / `interactive`
- 独立预算上限
- 权限策略 (默认收紧到只读)
- 失败策略: retry / skip / escalate / halt
- 持久化: `scheduled_tasks` (定义) + `scheduled_task_runs` (执行日志)

### 11.2 调度状态机 (06 §3.14.3)

```
      [create]            [enable]         [due/cron tick]       [exec success]
disabled ──────► enabled ──────► due ──────────► running ──────────► done
   ▲                  │             │                       │
   │ [disable]        │ [disable]   │                       │ [failed (retry<max)]
   │                  ▼             │                       ▼
   ...                                                       failed ──► escalate/halt
                                                              │
                                                              └► cancelled
```

### 11.3 关键算法 (06 §3.14.4)

1. **启动恢复**: 服务启动加载 `scheduled_tasks WHERE enabled=1`，按 cron 表达式重建 next_run_at；丢失的 due 检查并按失败策略处理
2. **触发分发**: `node-cron` 注册 cron；interval/once 用 setTimeout + 持久化校验避免重复
3. **事件触发**: 复用 EventBus 监听 `on_commit / on_idle / on_cost_warn`，按 event_name 字段匹配
4. **执行隔离**: SchedulerExecutor 经 Worker Threads 启动 Run；默认 `read_only` 沙箱 + 复用 PermissionGateway
5. **审计**: Run 全部调用经 audit_log (与手工调用同型)
6. **失败处理**: max_retries + failure_policy；连续 K 次失败 → escalate

### 11.4 安全约束 (06 §3.14.5)

- 周期性破坏性任务启用前必须有一次 dry_run 成功 (强制 `dry_run_persist_id` 存在)
- L2/L3 操作必须在任务定义中显式声明并预先审批 (`pre_approval_tokens` 字段)
- 全局并发上限 `scheduler.max_concurrent` (默认 2)
- 单任务速率限制 `scheduler.per_task_rate_limit` (tokens/min)

### 11.5 与 Goal / Hooks 联动

- 关联 `goal_id` 时 Run 完成/失败写入 Goal 进度 (§10)
- 完成 / 失败触发 `scheduler.run.completed` / `.failed` 事件供 Hooks 监听

---

## 12. 提示词管理 PROMPT (D9-PROMPT, v0.2 启用)

### 12.1 功能规格 (02 REQ-PROMPT-001~006)

| 功能 | 描述 | 表 |
|------|------|----|
| 模板库 | 命名模板 + 变量插值 + 条件块 (Handlebars) | prompt_templates |
| 七层独立编辑 | 每层独立编辑/版本化/diff | prompt_templates (7 层 JSON 字段) |
| 模型适配变体 | 同模板声明多 Provider 变体 | prompt_template_variants |
| 版本化/回滚 | 每次修改生成版本快照；可 diff/回滚/标记 released | prompt_template_revisions (可选) |
| A/B 实验 | 两版本按权重分流 | prompt_ab_assignments |
| Playground | 离线 dry-run 调试 (不触发主 Loop) | 后端 RPC 方法 |
| 作用域 | global / project / persona / session 叠加优先级 | prompt_templates.scope |
| 复用与分享 | 模板导出 YAML / 包；团队 Profile 内置 | - |
| 审计与合规 | 模板变更有审计；企业可锁定某些层只读 | audit_log |

### 12.2 七层洋葱模型

```
system_meta → system_persona → system_policy → context_block →
tool_manifest → user_message → memory_block
```

每层独立编辑、版本化、diff；保留默认层并支持 Layer override。

### 12.3 渲染管线 (06 §3.16.3)

```
context_pipeline ─► compose(prompt_layers) ─► PickVariant(provider) ─►
  Render(handlebars, vars) ─► final prompt ─► 注入 Loop Perceive 阶段
```

### 12.4 Playground 流程 (06 §3.16.4)

RPC 方法 `prompt.playground(req)`:
1. 加载 template + variants + 用户 vars
2. 选定 provider 实例化 Adapter
3. 不写入主 Loop；调用计 cost 写 `model_calls.tag='playground'` (审计标"调试"，不污染主统计)
4. 返回: render 后 prompt + token 预算 + 模型输出 + 用时

### 12.5 A/B 实验算法 (06 §3.16.5)

- 分流: `hash(sessionId + experimentId) % 100 < weight` 选 variant → 记录 assignment 到 `prompt_ab_assignments`
- 后续按 experimentId 统计 success rate / cost / satisfaction
- 显著性提示 (接 01 §4.13 A/B 框架)；winner 可一键发布为 `released`

---

## 13. Transport 层与 JSON-RPC 服务 (D10)

### 13.1 通信协议 (06 §4.1)

- **JSON-RPC 2.0** (自实现，零依赖)
- 请求 / 响应 / 通知 (notification) 三种消息
- 批量请求支持 (v0.2+)
- 错误码标准化 (`-32700 ~ -32099` 见 §6 错误码定义)

### 13.2 Transport 适配层 (06 §4.4)

| Transport | v0.1 | 场景 |
|-----------|:---:|------|
| **Embedded** (直接调用 Dispatcher) | ✅ | 桌面进程内 |
| **Electron IPC** (ipcRenderer/Main + contextBridge) | ✅ | v0.1 Desktop |
| **stdio** | v0.2 | CLI / TUI |
| **HTTP + SSE** (Fastify 5.x) | v0.2 | Web 远程 |
| **WebSocket** (ws 8.x + @fastify/websocket) | v0.2 | Web 双向流 |

### 13.3 API 方法清单 (按域, 06 §4.2)

#### Agent 域
- `agent.run(req)` — stream → 启动 PAOR Loop，流式回吐 `agent.event`
- `agent.stop(sessionId)`
- `agent.inspect(sessionId)` — 查询当前状态 (用于补发补偿)
- `agent.approve(toolCallId, decision)` — HITL 决策
- `agent.branch(sessionId, stepId)` — 分支会话
- `agent.retry(sessionId, stepId)` — 回退重试
- `agent.edit(sessionId, messageId|stepId, value)` — 动态结果调整

#### Session 域
- `session.create / list / archive / search / restore / delete`

#### Tool 域
- `tool.list / tool.execute / tool.approveQueue`
- `mcp.list / mcp.add / mcp.update / mcp.remove / mcp.health`

#### Context 域
- `context.assemble(sessionId)` — 获取当前组装上下文
- `context.pin / context.unpin / context.evict`
- `context.searchCodebase(query)` — RAG 混合检索

#### Memory 域
- `memory.list / read / write / forget`

#### Config 域
- `config.get / set / reset / history / rollback / hotReload`

#### Provider 域 (v4.3 新增)
- `provider.list / register / enable / disable / health / pricing`

### 13.4 字段顺序与分阶段实现 (06 §4.11)

| 方法 | v0.1 | v0.2 | v0.3 | v0.4 |
|------|:---:|:---:|:---:|:---:|
| Agent 基础 (run/stop/inspect/approve/edit/branch/retry) | ✅ | ✅ | ✅ | ✅ |
| Session/Config/Tool/MCP 基础 | ✅ | ✅ | ✅ | ✅ |
| Provider 域 | ✅(list/health) | ✅(register) | ✅(custom Adapter) | ✅ |
| Memory 域 | | ✅ | ✅ | ✅ |
| Hook / Skill / Plugin 域 | | | ✅ | ✅ |
| Scheduler 域 | | | | ✅ |
| Goal 域 | | | ✅ | ✅ |
| Prompt 域 (template) | | ✅ | ✅ | ✅ |
| Prompt 域 (A/B/Playground) | | | | ✅ |

### 13.5 客户端 SDK (06 §4.5)

`OpenCodeClient` 提供:
- `client.subscribe(event)` / `client.unsubscribe(event)`
- `client.call(method, params)` — 返回 `AsyncIterable` (流式)
- `client.batch(calls)`
- `client.abort(callId)`
- Transport 透明切换 (HTTP/SSE/WS/stdio/IPC/Embedded)
- 自动重连 + 鉴权注入

### 13.6 请求追踪与 Transport 调试器 (06 §4.14)

- 每请求生成 `requestId` (UUID v7)，回写响应
- 开发态经 `TransportTracer` 中间件记录请求/响应 (日志 + 内存环形 buffer)
- `RpcReplayer` 回放工具：从日志重放请求测试后端幂等性

---

## 14. 安全与合规

### 14.1 API Key 安全存储 (02 REQ-SEC-001 [P0])

- macOS Keychain / Windows Credential Manager / Linux Secret Service (经 `KeychainPort` 抽象)
- 内存中最小化密钥暴露 (零渲染、零日志、零序列化)
- 企业模式可选 refresh token / 网关代发

### 14.2 沙箱执行 (02 REQ-SEC-002 [P0])

- 文件操作限制在项目根 + 显式白名单 (FileSystemPort 仲裁)
- 终端命令 allowlist + blocklist 双重过滤 (CommandFilter)
- 网络访问可按域名白名单 (DomainFilter)
- 3 种沙箱模式: `native` / `docker` / `wasm` (Plugin 沙箱用 isolated-vm)
- 隔离 Worker (Worker Threads) 进程隔离

### 14.3 审计日志 (02 REQ-SEC-003)

- `audit_log` 表 append-only 写入；不可删除
- 记录: 时间 / 操作者 / 操作 / 目标 / 详情
- 可选签名防篡改 (Ed25519 签名链)
- L3 操作强制审计 (永远确认 + 不可擦除)

### 14.4 隐私与遥测 (02 REQ-SEC-004)

- 默认关闭；首次启动征询
- 仅采集匿名统计 (功能使用频率 / 错误率)；不含代码/文件/Prompt
- 完整可关；可查看采集内容

### 14.5 供应链安全 (02 REQ-SEC-005)

- 依赖锁定 (npm lockfile)
- SBOM 生成 (`cyclonedx-npm` 或 `npm sbom`)
- CI 中 CVE 扫描 (Dependabot / OSV-Scanner)
- 构建产物签名 (sigstore)

### 14.6 服务式模式认证与安全基线 (04 §13)

- 使用 HTTP + 严格 CORS 白名单
- token 鉴权支持：
  - local mode: 共享 token (本地配置) + 初始签名握手防重放
  - remote mode: JWT Bearer / OAuth OIDC (企业)
- 三方前置 Proxy：组织可前置 Nginx/Cloudflare 添加 mTLS / 审计
- RateLimit 在 Service 层配套 (默认 100 req/min/IP)
- 源 Origin 白名单防跨域调用

---

## 15. 可观测性与成本归因

### 15.1 Loop Trace (02 REQ-OBS-001)

- 每步 Perceive/Act/Observe/Reflect 记录 `loop_steps`
- 时间线视图数据源 (经 RPC + 事件)
- 展开查看: prompt / 工具调用 / 返回结果 / 耗时 / 成本
- 持久化到 DB → 可回放 (time-travel)

### 15.2 Prompt Inspector (02 REQ-OBS-002)

- 七层洋葱模型数据来源 (PromptService 渲染时的中间产物)
- 每层 token 占用 / diff / 复制导出
- Prompt Playground (PROMPT 域 §12)

### 15.3 成本分析与归因 (02 REQ-OBS-004)

- 实时累计 token / 费用 (model_calls 表聚合)
- 按会话 / 项目 / 日 / 模型维度统计
- 预算告警 (会话级 + 日级 + 项目级) → 触发 `on_cost_warning` 事件
- 成本归因到 Loop step + Sub-Agent (`model_calls.parent_session_id` 树形)

### 15.4 后端日志层 (04 §11.7)

- pino (非 winston，性能最优)
- 结构化 JSON 日志 + 上游可接 ELK / Loki
- 日志分级: trace / debug / info / warn / error / fatal
- 默认 file rotation 至 `logs/server.log` + 终端 stdout (开发态)

### 15.5 性能指标 (Deploy 后)

| 指标 | v0.1 目标 | v1.0 目标 |
|------|:---:|:---:|
| agent.run P99 端到端延迟 (含 RPC) | < 200ms | < 100ms |
| Loop step 持久化 P99 (事务含 3 表) | < 30ms | < 15ms |
| 向量检索 P99 (10 万 chunk) | N/A | < 200ms |
| SQLite WAL 写入吞吐 | 5K TPS | 15K TPS |

---

## 16. 服务端非功能需求

### 16.1 可靠性

| 指标 | v0.1 目标 |
|------|:---:|
| 崩溃自动恢复 | 100% 未完成会话可恢复 (经 checkpoint) |
| 数据备份 | 每 30 分钟 SQLite 自动备份 |
| WAL 模式并发 | 读写并发安全；写串行化经 `++db.tx_lock` |
| 错误处理 | 所有错误有可读提示 + 结构化错误码 (见 §6.0) |
| 离线可用 | 本地 SQLite + 本地 Ollama 完整工作 |

### 16.2 扩展性 (DDD Repository)

| 维度 | 设计 |
|------|------|
| 表数量演进 | 12 → 20 → 远期可扩展 (Drizzle schema 单一源 → 自动迁移) |
| 存储引擎替换 | 从 SQLite 切到 Postgres 仅需实现 Postgres*Repository 即可，业务零修改 |
| 单机 / 远端切换 | SqliteRepositoryProvider ↔ RemoteHttpRepositoryProvider 切换 |
| 多租户 | `dataDir` 分离 + Profile `scope` 隔离；v1.0+ 远程服务模式 |

### 16.3 性能与延迟预算 (04 §3.4 9 层架构)

| 层 | v0.1 P99 | v1.0 P99 |
|----|:---:|:---:|
| L1 Transport (Embedded) | < 5ms | < 2ms |
| L2 Application Service | < 5ms | < 3ms |
| L3 Domain Service | < 5ms | < 3ms |
| L4-5 (类型/Repository 接口) | < 1ms | < 1ms |
| L7 Repository Implementations (DRIZ bit) | < 20ms | < 10ms |
| L8 Storage Adapter (better-sqlite3) | < 5ms | < 3ms |
| LLM API (provider) | < 1000ms (TTFT) | < 500ms |

---

## 17. 服务端需求矩阵

### 17.1 P0 (v0.1 必须交付)

| REQ ID | 域 | 描述 |
|--------|----|------|
| REQ-AGENT-001 | Agent | PAOR 主循环 |
| REQ-AGENT-002 | Agent | Planning Loop 子循环 |
| REQ-TOOL-001 | Tool | 内置工具集 (18) |
| REQ-TOOL-002 | Tool | 权限网关 (L0-L3) |
| REQ-TOOL-004 | Tool | 模型抽象层 (5 Provider v0.1) |
| REQ-DATA-001 | Data | SQLite 全量持久化 (12 表) |
| REQ-DATA-002 | Data | 配置数据库化 + 版本化 |
| REQ-DATA-003 | Data | 会话持久化 + 崩溃恢复 |
| REQ-EXT-001 | Ext | MCP 一等公民 |
| REQ-SEC-001 | Sec | API Key 安全存储 |
| REQ-SEC-002 | Sec | 沙箱执行 |

### 17.2 服务端独特需求 (从前后端分离中沉淀)

| REQ ID | 描述 |
|--------|------|
| REQ-PROVIDER-001 | Provider Registry 热插拔 (v0.1 写入 providers 表) |
| REQ-PROVIDER-002 | Adapter 契约 + 能力位协商 |
| REQ-DATA-005 | Migration Manager (Drizzle 单一真相源) |
| (隐式) Repository 接口隔离 | 领域层零 SQL；infra 可替换为 Sqlite/InMemory/Remote/Postgres |

### 17.3 v0.2~v0.4 增量需求 (服务端视角)

| REQ ID | 域 | 版本 |
|--------|----|------|
| REQ-CTX-002~008 | 上下文压缩/RAG/记忆/钉选 | v0.2 |
| REQ-AGENT-007/008/009 | Sub-Agent/Recovery/Verification | v0.2~v0.3 |
| REQ-EXT-002/003/004 | Hooks/Skills/Plugins | v0.2~v0.3 |
| REQ-MIG-001~005 | 导入导出/同步/团队共享 | v0.2~v0.5 |
| REQ-PROVIDER-003/004 | 路由/Fallback/自定义 SDK | v0.3 |
| REQ-GOAL-001~005 | 目标管理 | v0.3 |
| REQ-PROMPT-001~006 | 提示词管理 (模板/Playground/A-B) | v0.2~v0.4 |
| REQ-SCHED-001~004 | 定时任务 | v0.4 |

---

## 附录 A: 后端包结构目录

```
packages/
├── core/                       # headless Agent 引擎 (无 Electron)
│   ├── src/
│   │   ├── domain/            # 领域层 (接口 + 实体)
│   │   │   ├── entity/        # 聚合根 (Session/Message/Tool/Goal/...)
│   │   │   ├── repository.ts  # Repository<T> 泛型接口
│   │   │   └── repositories/  # 各聚合仓储接口
│   │   ├── application/       # 用例编排 / Service / 事务边界
│   │   │   ├── agent/         # LoopEngine / ContextManager
│   │   │   ├── tool/          # ToolDispatcher / PermissionGateway
│   │   │   ├── mcp/           # MCP Client
│   │   │   ├── provider/      # ProviderRouter
│   │   │   ├── memory/ hook/ skill/ subAgent/ plugin/
│   │   │   ├── scheduler/     # SchedulerService (v0.4)
│   │   │   ├── goal/ prompt/  # GoalService PromptService
│   │   │   └── config/        # ConfigService
│   │   ├── infra/             # 基础设施层 (实现 + 驱动)
│   │   │   ├── db/
│   │   │   │   ├── sqlite/    # Sqlite*Repository
│   │   │   │   ├── drizzle/   # schema.ts + client.ts
│   │   │   │   ├── in-memory/ # InMemoryRepositoryProvider (单测)
│   │   │   │   ├── migrations/ # Drizzle 生成的 SQL (+ §2.4 Migration Manager)
│   │   │   │   └── ports/    # VectorIndex/FtsIndex/Keychain/FileSystem Port
│   │   │   ├── security/      # Crypto / AuditLog / KeychainPort impl
│   │   │   ├── sandbox/       # isolated-vm + Better Node Sandbox
│   │   │   └── logger/        # pino 配置
│   │   └── util/
├── server/                     # JSON-RPC 后端宿主
│   ├── src/
│   │   ├── runtime.ts         # BackendService (mode/status/shutdown/health)
│   │   ├── transport/
│   │   │   ├── EmbeddedTransport.ts
│   │   │   ├── IPC.ts
│   │   │   ├── HttpSse.ts
│   │   │   ├── WebSocket.ts
│   │   │   ├── Stdio.ts
│   │   │   ├── Dispatcher.ts        # JSON-RPC 2.0 分发
│   │   │   └── evenBridge.ts
│   │   ├── auth/              # token/JWT/OIDC (v0.2+)
│   │   └── ratelimit/         # RateLimit middleware
├── ai-sdk/                     # 自研 @openwork/ai-sdk (v0.3+)
│   ├── src/
│   │   ├── types.ts           # AIProviderAdapter 契约
│   │   ├── capabilities.ts
│   │   ├── baseAdapter.ts
│   │   ├── registry.ts
│   │   ├── router.ts
│   │   ├── fallback.ts
│   │   ├── pricing.ts
│   │   └── builtinAdapters/
│   │       ├── openaiAdapter.ts
│   │       ├── anthropicAdapter.ts
│   │       ├── googleAdapter.ts
│   │       ├── ollamaAdapter.ts
│   │       └── openaiSchemaAdapter.ts  # 任意 OpenAI 兼容
└── api/                        # JSON-RPC 类型契约 (前后端共享)
    └── src/
        ├── protocol.ts        # JSON-RPC 2.0 类型
        ├── methods.ts         # API 方法清单
        ├── events.ts          # 事件清单
        └── client.ts          # OpenCodeClient SDK 类型
```

---

## 附录 B: 关键 TS 接口索引

| 接口 | 位置 | 描述 |
|------|------|------|
| `Repository<T>` | 04 §16.10.1 | 泛型仓储基接口 |
| `RepositoryProvider` | 04 §16.10.3 | 仓储注入入口 + withTx |
| `SessionRepository` 等 (20 接口) | 04 §16.10.2 | 各聚合仓储清单 |
| `AIProviderAdapter` | 06 §3.17.2 | Provider 适配器契约 |
| `ProviderRouter` | 06 §3.17 | Provider 路由器 |
| `FallbackChain` | 06 §3.17.5 | Provider Fallback 链 |
| `MCPClient` | 06 §3.x (MCP) | MCP 客户端契约 |
| `ToolDispatcher` / `ToolRegistry` | 06 §3.2 | 工具分发与注册 |
| `PermissionGateway` | 06 §3.5 | 权限仲裁 |
| `SchedulerService` / `SchedulerEngine` | 06 §3.14 | 调度器 |
| `GoalService` / `GoalProgressEvaluator` | 06 §3.15 | 目标管理 |
| `PromptService` / `PromptRenderer` | 06 §3.16 | 提示词管理 |
| `EventBus` / `EventBridge` | 04 §12 + 06 §3.x | 事件总线 + 跨 Transport 桥 |
| `BackendService` / `BackendHandle` | 06 §4.x | 后端生命周期 + Transport 注册 |
| `OpenCodeClient` | 06 §4.5 | 客户端 SDK |

---

## 附录 C: 数据库 20 表清单与版本节奏

| # | 表名 | v0.1 | 域 |
|---|------|:---:|----|
| 1 | sessions | ✅ | Agent |
| 2 | messages | ✅ | Agent |
| 3 | tool_calls | ✅ | Tool |
| 4 | loop_steps | ✅ | Agent |
| 5 | configs | ✅ | Config |
| 6 | config_history | ✅ | Config |
| 7 | mcp_servers | ✅ | MCP |
| 8 | profiles | ✅ | Configuration |
| 9 | audit_log | ✅ | Security |
| 10 | model_calls | ✅ | AI Provider |
| 11 | checkpoints | ✅ | Agent |
| 12 | providers | ✅ | AI Provider |
| 13 | memories | v0.2 | Context |
| 14 | hooks | v0.2 | Extension |
| 15 | skills | v0.3 | Extension |
| 16 | sub_agents | v0.3 | Agent |
| 17 | commands | v0.2 | Configuration |
| 18 | index_meta | v0.2 | Context |
| 19 | goals | v0.3 | Goal |
| 20 | scheduled_tasks | v0.4 | Scheduler |
| 21 | scheduled_task_runs | v0.4 | Scheduler |
| 22 | prompt_templates | v0.2 | Prompt |
| 23 | prompt_template_variants | v0.2 | Prompt |

> 完整 DDL 与字段定义见 06 §2.1；Drizzle schema 见 06 §2.8.2；Repository 接口见 04 §16.10。

---

> **文档结束** | OpenWork Server PRD v1.0 | 2026-07-25 | MIT | 本文档是后端编码与 QA 的直接依据；技术架构权威基线见 04 v4.3 / 06 v4.3 / 05 v4.3。