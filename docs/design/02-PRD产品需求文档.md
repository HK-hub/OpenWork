# OpenCoding Agent Desktop — 产品需求文档 (PRD)

> **文档版本**: v2.4 (Harness 能力对标 + 四能力域补齐 + CS 分离契约指针 + UI/LobeHub 退役)
> **文档类型**: Product Requirements Document
> **审视视角**: 产品经理 (PM) / 项目总监 (PMO) / QA
> **参考对标**: pi agent / Claude Code / Codex CLI / OpenCode / Cursor / Cline
>
> **v2.3 变更说明**: 根据 07-多角色审视评估报告 §1.1 (S1)、§4.4 (M10) 与 §8.3 总体结论，收缩 v0.1 范围为"Desktop (嵌入式) + 4 模块 + 12 表 + 6-8 周"。具体调整：§1.1 产品定义增加 v0.1 阶段性说明；§3.9 多客户端需求中 REQ-UI-008 (TUI) 与 REQ-UI-010 (CLI) 优先级由 P1 降级为 P2，并新增 v0.1 仅交付 Desktop 客户端的说明；§2.2 需求统计表"多客户端"行拆分为"Desktop 客户端"与"多客户端 (TUI/Web/CLI/Custom)"两行并更新总计；§8 风险登记册新增 R14~R18 共 5 项前后端分离架构相关风险 (JSON-RPC 序列化开销、isolated-vm V8 耦合、monorepo 构建复杂度、better-sqlite3 跨 Worker 限制、v0.1 收缩导致用户流失)。
>
> **v2.2 变更说明**: 前后端分离架构对齐：产品需求从单一桌面端扩展为多客户端平台（Desktop/TUI/Web/CLI）。新增 REQ-UI-008 TUI 客户端、REQ-UI-009 Web 客户端、REQ-UI-010 CLI 客户端需求。更新风险登记册移除 Tauri 相关风险。
>
> **v2.4 变更说明 (Harness 能力对齐版)**: 根据 pi agent / Claude Code CLI / OpenCode / Codex CLI 的核心能力与 harness 能力清单批判式审查，补齐四类缺失能力并修复跨文档冲突：
> - **新增需求域与 REQ**: SCHED (定时任务) REQ-SCHED-001~004 / GOAL (目标管理) REQ-GOAL-001~005 / PROMPT (提示词管理) REQ-PROMPT-001~006 / PROVIDER (Provider 抽象接入) REQ-PROVIDER-001~004，共新增 **19 项需求**。
> - **修复冲突**: ① §4.1 性能指标将陈旧 Tauri 标注修正为 Electron（与 §1.1/§3.9 架构一致）；② §6.1 "不包含" 列表与 doc01 §6.2 路线图双向对齐：Hooks/动态结果调整/成本仪表盘/导出导入/Onboarding 统一为 v0.2；③ §3.3 REQ-TOOL-004 与 §6.1 v0.1 "5 个 Provider" 明确为"v0.1 落地子集为 5 个，抽象层全量 Provider 适配器在 v0.2+ 增补"；④ §3.5 REQ-DATA-001 表清单与 doc01 §4.5.1 对齐为"全景 20 表 / v0.1 落地 12 表"。
> - **harness 对标**: 新增 §1.4「Harness 能力对标清单」指针，引用 01-产品功能文档 §1.6 矩阵。
> - **需求统计**: 新增 4 域 19 项需求后，需求总数由 181 调整为 **200**，P0 仍维持 19 项（新增能力均为 P1/P2，不冲击 MVP）。
>
> **v2.1 变更说明**: 根据用户决策，**禁止将 antd v6 + antd-style 作为首选 UI 框架**。遵循 [LobeHub 官方 React 组件编写指南](https://www.skills.sh/lobehub/lobehub/react)，UI 框架优先级调整为：**LobeHub UI（base-ui 无头原语优先）→ @lobehub/ui 高级组件 → 基于 LobeHub UI 封装 → antd v6 兜底 → 自定义实现**。新增需求 **REQ-UI-007: UI 框架优先级策略**。详见 [09 文档 v1.2 §0.4](./09-LobeHub生态集成方案.md) 与 [08 文档 v3.3](./08-技术选型与架构方案(实施版).md)。

---

## 目录

- [1. 产品概述](#1-产品概述)
- [2. 需求总览](#2-需求总览)
- [3. 核心需求详述](#3-核心需求详述)
  - [3.1 Agent 核心引擎需求](#31-agent-核心引擎需求)
  - [3.2 上下文与知识管理需求](#32-上下文与知识管理需求)
  - [3.3 工具与能力扩展需求](#33-工具与能力扩展需求)
  - [3.4 对话与交互需求](#34-对话与交互需求)
  - [3.5 持久化与数据管理需求](#35-持久化与数据管理需求)
  - [3.6 配置化与自定义需求](#36-配置化与自定义需求)
  - [3.7 扩展与生态需求](#37-扩展与生态需求)
  - [3.8 数据迁移与同步需求](#38-数据迁移与同步需求)
  - [3.9 多客户端需求](#39-多客户端需求)
  - [3.10 可观测与调试需求](#310-可观测与调试需求)
  - [3.11 安全与合规需求](#311-安全与合规需求)
  - [3.12 定时任务与调度需求 (v2.4 新增)](#312-定时任务与调度需求-v24-新增)
  - [3.13 目标管理需求 (v2.4 新增)](#313-目标管理需求-v24-新增)
  - [3.14 提示词管理需求 (v2.4 新增)](#314-提示词管理需求-v24-新增)
  - [3.15 AI Provider 抽象接入需求 (v2.4 新增)](#315-ai-provider-抽象接入需求-v24-新增)
- [4. 非功能需求](#4-非功能需求)
- [5. 需求优先级矩阵](#5-需求优先级矩阵)
- [6. MVP 范围定义](#6-mvp-范围定义)
- [9. 需求变更流程](#9-需求变更流程)
- [8. 风险登记册](#8-风险登记册)

---

## 1. 产品概述

### 1.1 产品定义

OpenCoding Agent Desktop 是一款开源、本地优先、高度可配置的 Coding Agent 多客户端平台。后端采用无头 (headless) 引擎架构，前端提供 Desktop / TUI / Web / CLI 多种客户端，通过 JSON-RPC 2.0 over 多 Transport (HTTP/SSE、WebSocket、stdio、Electron IPC、Embedded) 与后端通信。它将 LLM 推理、工具执行、代码库感知、工作流编排封装为可交互、可中断、可审计的智能体，并支持用户基于 @opencode/api 契约自定义客户端开发。

> **v0.1 阶段性说明** (v2.3 新增): 多客户端平台是产品的**长期愿景**，但 v0.1 优先交付 Desktop 客户端 (Embedded 模式)，仅实现 Embedded + Electron IPC 两种 Transport。TUI / Web / CLI 客户端 (REQ-UI-008~010) 与自定义客户端 SDK (REQ-UI-011) 降级为 v0.2+；服务式 (Service) 后端、Sub-Agent、Multi-Agent 等多客户端相关能力推迟到 v0.2~v0.3。这一收缩策略参照 07-多角色审视评估报告 §1.1 (S1) 与 §8.3 总体结论，使 v0.1 在 6-8 周内可交付，同时保留 v4.1 前后端分离架构的演进余地。多客户端平台愿景与 v4.1 架构演进方向保留不变。

### 1.2 核心价值主张

1. **Agent 原生**: 内置完整 PAOR 循环，非简单 Chat 封装
2. **全链路可观测**: 每一步 Prompt/上下文/工具调用/Loop 状态可视化
3. **全过程可干预**: 任何时候修改对话/结果/决策，动态调整而非打断重来
4. **配置即产品**: 所有变量参数通过声明式配置对外暴露
5. **全生命周期扩展**: Hooks/插件/MCP/Skills/Sub-Agent 五条等价扩展通道
6. **数据主权**: SQLite 全量持久化，一键导出迁移

### 1.3 目标用户

| 画像 | 占比 | 核心场景 |
|------|:---:|----------|
| 全栈独立开发者 | 40% | 日常编码、重构、调试 |
| 企业研发团队 | 30% | 团队协作、审计合规 |
| 开源贡献者/插件作者 | 15% | 开发扩展 |
| AI/Agent 研究者 | 10% | 实验、观测、对比 |
| 学习者/教学者 | 5% | 学习、教学 |

### 1.4 Harness 能力对标清单 (v2.4 新增)

本产品以 pi agent / Claude Code CLI / OpenCode / Codex CLI 的核心能力与 harness 能力清单为基线，确保 18 项能力维度全覆盖。完整的 36 项能力 × 5 产品对标矩阵见 **[01-产品功能文档 §1.6](./01-产品功能文档.md#16-harness-能力全景对标清单-v24-新增)**。下表仅列出本 PRD 新增四域（v2.4）对应的能力指针：

| 能力维度 | 对标现状 | 本产品覆盖需求 |
|----------|----------|----------------|
| AI Provider 全兼容抽象接入 | Claude Code 单一/部分；OpenCode 多 | REQ-PROVIDER-001~004 + REQ-TOOL-004 |
| 提示词管理 (模板/版本/分享/A-B) | 各家仅部分可看 | REQ-PROMPT-001~006 |
| 目标管理 (Goal 跨会话续作) | 各家仅一次性 Task | REQ-GOAL-001~005 |
| 定时任务 (cron/interval/event 调度) | 缺失/仅手工 | REQ-SCHED-001~004 |

---

## 2. 需求总览

### 2.1 需求编号规则

```
REQ-{域}-{序号}  例: REQ-AGENT-001
域: AGENT(核心引擎) | CTX(上下文) | TOOL(工具) | CHAT(对话交互) | DATA(持久化) | CFG(配置化) | EXT(扩展) | MIG(迁移) | UI(多客户端) | OBS(可观测) | SEC(安全) | SCHED(定时任务, v2.4) | GOAL(目标管理, v2.4) | PROMPT(提示词管理, v2.4) | PROVIDER(Provider 抽象接入, v2.4)
```

### 2.2 需求统计

> **v2.3 调整说明**: 原"多客户端"行拆分为"Desktop 客户端" (REQ-UI-001~007，v0.1 交付) 与"多客户端 (TUI/Web/CLI/Custom)" (REQ-UI-008~011，v0.2+) 两行。REQ-UI-008 (TUI) 与 REQ-UI-010 (CLI) 优先级由 P1 降级为 P2，详见 §3.9。

| 域 | P0 | P1 | P2 | P3 | 合计 |
|----|:---:|:---:|:---:|:---:|:---:|
| Agent 核心引擎 | 2 | 12 | 4 | 2 | 20 |
| 上下文与知识 | 0 | 13 | 4 | 2 | 19 |
| 工具与能力 | 3 | 8 | 3 | 1 | 15 |
| 对话与交互 | 3 | 10 | 3 | 2 | 18 |
| 持久化与数据 | 3 | 9 | 2 | 1 | 15 |
| 配置化与自定义 | 2 | 11 | 5 | 2 | 20 |
| 扩展与生态 | 1 | 10 | 5 | 3 | 19 |
| 数据迁移与同步 | 0 | 8 | 4 | 2 | 14 |
| Desktop 客户端 (REQ-UI-001~007) | 3 | 4 | 0 | 0 | 7 |
| 多客户端 (TUI/Web/CLI/Custom, REQ-UI-008~011) | 0 | 0 | 4 | 0 | 4 |
| 可观测与调试 | 0 | 10 | 4 | 2 | 16 |
| 安全与合规 | 2 | 7 | 3 | 2 | 14 |
| 定时任务与调度 (v2.4 新增) | 0 | 2 | 2 | 0 | 4 |
| 目标管理 (v2.4 新增) | 0 | 3 | 2 | 0 | 5 |
| 提示词管理 (v2.4 新增) | 0 | 4 | 2 | 0 | 6 |
| Provider 抽象接入 (v2.4 新增) | 0 | 2 | 2 | 0 | 4 |
| **合计 (v2.4)** | **19** | **113** | **49** | **19** | **200** |

---

## 3. 核心需求详述

### 3.1 Agent 核心引擎需求

#### REQ-AGENT-001: PAOR 主循环 [P0]

**描述**: 实现 Perceive-Act-Observe-Reflect 四阶段核心循环。

**验收标准**:
- [ ] Perceive 阶段能整合文件/Git/诊断/选区/历史上下文
- [ ] Act 阶段 LLM 能正确选择并调用工具 (含 0 工具纯文本回答)
- [ ] Observe 阶段能结构化解析工具输出
- [ ] Reflect 阶段每 N 轮 (可配置) 触发自评
- [ ] 循环在以下条件自动终止: 任务完成 / 达到 max_iterations / 用户停止 / 成本超限 / 不可恢复错误

**关联需求**: REQ-OBS-001 (Loop Trace)

#### REQ-AGENT-002: Planning Loop 子循环 [P0]

**描述**: 复杂任务自动触发规划子循环。

**验收标准**:
- [ ] 当预计步数 > `planning.auto_plan_threshold` (默认 3) 时自动触发
- [ ] 产出任务 DAG (含依赖关系)
- [ ] 用户可审批/修改/调整优先级
- [ ] 依赖拓扑排序执行
- [ ] 支持通过配置关闭自动规划

#### REQ-AGENT-003: 循环暂停与恢复 [P1]

**描述**: 用户可在任意时刻暂停 Agent 循环，并可从检查点恢复。

**验收标准**:
- [ ] 按 ESC 或停止按钮立即暂停当前循环
- [ ] 暂停时自动保存当前 Loop 状态为检查点
- [ ] 恢复后从最近检查点继续，重新组装上下文
- [ ] 支持手动创建检查点 (`/checkpoint` 命令)
- [ ] 检查点持久化到数据库

#### REQ-AGENT-004: HITL 人工干预 [P1]

**描述**: 在关键节点暂停等待人工确认。

**验收标准**:
- [ ] 三档模式: every_step / key_nodes / trust
- [ ] key_nodes 模式在破坏性操作 (delete/run_command/force_push) 前暂停
- [ ] 干预动作: 批准/修改/拒绝/接管
- [ ] 审批缓存减少重复确认 (once/session/project/permanent)
- [ ] 危险操作 dry-run 预览

#### REQ-AGENT-005: 工具并发执行 [P1]

**描述**: Agent 可一次请求多个独立工具，引擎并发调度。

**验收标准**:
- [ ] LLM 在一次回复中声明多个工具调用
- [ ] 引擎识别无依赖关系的工具调用并发执行
- [ ] 并发数上限可配置 (默认 4)
- [ ] 并发执行结果合并后回流到 Loop

#### REQ-AGENT-006: 任务分解与编排 [P1]

**描述**: 大任务自动拆解为带依赖的子任务 DAG。

**验收标准**:
- [ ] Planning Loop 产出 DAG
- [ ] 依赖拓扑排序执行
- [ ] 无依赖子任务可并行派发 Sub-Agent
- [ ] 进度可视化: 任务树 + 当前节点 + 阻塞原因
- [ ] 结果聚合: 合并/取最新/人工裁决

#### REQ-AGENT-007: Sub-Agent 派生 [P1]

**描述**: 主 Agent 可派生子 Agent 处理独立子任务。

**验收标准**:
- [ ] 支持主从/并行/专家三种模式
- [ ] Sub-Agent 上下文与主 Agent 隔离
- [ ] Sub-Agent 通过结构化消息通信
- [ ] Sub-Agent 成本归属到父任务
- [ ] 最大并行 Sub-Agent 数可配置
- [ ] Sub-Agent 预算与父任务预算联动

#### REQ-AGENT-008: Recovery Loop 错误恢复 [P1]

**描述**: 工具调用或测试失败时自动分析并尝试修复。

**验收标准**:
- [ ] 工具失败时返回结构化错误给 LLM (不抛异常中断)
- [ ] 测试失败时自动分析失败原因
- [ ] 最多重试 `recovery.max_retries` 次 (默认 3)
- [ ] 持续失败时的行为可配置: ask/abort/escalate
- [ ] 恢复过程记录到 Loop Trace

#### REQ-AGENT-009: Verification Loop 自动验证 [P1]

**描述**: 代码改动后自动运行验证。

**验收标准**:
- [ ] 自动运行测试 (可配置)
- [ ] 自动运行 Lint (可配置)
- [ ] 自动运行类型检查 (可配置)
- [ ] 验证结果写入 Observation
- [ ] 验证失败触发 Recovery Loop

#### REQ-AGENT-010: 时间旅行 [P2]

**描述**: 回退到历史某步重放。

**验收标准**:
- [ ] 从 Loop Trace 中选择任意步回退
- [ ] 确定性回放: 使用缓存的工具结果
- [ ] 非确定性重放: LLM 重新生成 (标注差异)
- [ ] 回退后可选择不同路径 (分支)

---

### 3.2 上下文与知识管理需求

#### REQ-CTX-001: 多源上下文采集 [P1]

**描述**: 从多个来源自动采集上下文。

**验收标准**:
- [ ] 支持 9 类来源: 显式/文件/代码库索引/Git/终端/编辑器/浏览器/项目配置/会话历史
- [ ] 每种来源可独立配置权重
- [ ] 每种来源可独立启用/禁用
- [ ] 显式上下文 (@文件/@符号) 自动钉选

#### REQ-CTX-002: 上下文压缩 [P1]

**描述**: Token 预算超限时自动压缩上下文。

**验收标准**:
- [ ] 分层摘要: 近因窗口(原样) → 摘要窗口(压缩) → 事实窗口(KV)
- [ ] Token 预算 = 模型窗口 - 输出预留 - 工具预留 - 动态预留
- [ ] 压缩策略可配置: compress-dynamic / truncate-tail / summarize-all / drop-low-weight
- [ ] 关键事实 (决策/约束) 压缩后结构化保留
- [ ] 压缩前后 diff 校验，关键信息丢失告警

#### REQ-CTX-003: 代码库索引 [P1]

**描述**: 自动索引项目代码库。

**验收标准**:
- [ ] 文件级索引: 路径/语言/大小/依赖
- [ ] 符号级索引: 基于 Tree-sitter 的类/函数/变量
- [ ] 块级索引: AST 切分 + 向量嵌入
- [ ] 增量更新: 文件变更触发增量重索引
- [ ] 支持 50+ 语言

#### REQ-CTX-004: 混合检索 [P1]

**描述**: 语义 + 关键词 + 结构三路混合检索。

**验收标准**:
- [ ] 语义检索: 向量相似度
- [ ] 关键词检索: BM25 / FTS5
- [ ] 结构检索: 符号图 / 引用图 / 调用链
- [ ] RRF (Reciprocal Rank Fusion) 融合排序
- [ ] 检索 top_k 可配置 (默认 10)
- [ ] 支持显式 (@symbol) 和隐式 (LLM 主动调用) 两种触发

#### REQ-CTX-005: 记忆系统 [P1]

**描述**: 三级记忆存储与检索。

**验收标准**:
- [ ] 工作记忆: 会话级，可手动转存为项目记忆
- [ ] 项目记忆: 持久化，项目约定/决策/教训
- [ ] 全局记忆: 跨项目，用户偏好/通用经验
- [ ] 记忆分类: decision/fact/preference/lesson/todo
- [ ] Agent 可主动调用 memory_write 工具写入
- [ ] Hooks 可自动提取记忆 (如任务完成后总结)
- [ ] 记忆可搜索/编辑/遗忘

#### REQ-CTX-006: Token 仪表盘 [P1]

**描述**: 实时展示当前 prompt 的 token 占用。

**验收标准**:
- [ ] 按来源分块着色展示 token 分布
- [ ] 实时更新 (每次推理前)
- [ ] 显示预算使用百分比
- [ ] 超预算告警

#### REQ-CTX-007: 上下文来源树 [P1]

**描述**: 展示每次推理实际发送的内容。

**验收标准**:
- [ ] 树形展示: 文件/摘要/检索结果/历史消息
- [ ] 每个节点显示 token 占用
- [ ] 可展开查看具体内容
- [ ] 支持前后两次推理的 diff 对比

#### REQ-CTX-008: 上下文钉选与驱逐管理 [P1]

**描述**: 用户可手动管理上下文内容。

**验收标准**:
- [ ] 钉选: 文件/代码段标记为不驱逐
- [ ] 驱逐日志: 被丢弃内容可查看和找回
- [ ] 手动驱逐: 用户可主动移除上下文
- [ ] 驱逐策略: LRU + 重要度

---

### 3.3 工具与能力扩展需求

#### REQ-TOOL-001: 内置工具集 [P0]

**描述**: 提供 18+ 内置工具。

**验收标准**:
- [ ] 文件操作: read/write/edit/delete/move
- [ ] 搜索: glob/grep/search_codebase
- [ ] 终端: run_command/run_background
- [ ] 编辑: editor_action/diagnostics
- [ ] 网络: web_search/web_fetch/browser_*
- [ ] 记忆: memory_read/memory_write
- [ ] 任务: todo_write/task_spawn
- [ ] 扩展: mcp_call/skill_invoke

#### REQ-TOOL-002: 权限网关 [P0]

**描述**: 四级权限分级 + 确认机制。

**验收标准**:
- [ ] L0 (只读): 自动允许
- [ ] L1 (变更): 按策略 auto/approve/deny
- [ ] L2 (破坏性): 默认需确认
- [ ] L3 (关键): 永远需确认 + 不可擦除审计
- [ ] 确认机制: once/session/project/permanent
- [ ] 每工具可独立配置权限策略

#### REQ-TOOL-003: 沙箱执行 [P1]

**描述**: 工具在受限环境中执行。

**验收标准**:
- [ ] 文件操作限制在项目根 + 显式白名单
- [ ] 终端命令 allowlist + blocklist 双重过滤
- [ ] 网络访问可按域名白名单限制
- [ ] 支持 native / docker / wasm 三种沙箱模式

#### REQ-TOOL-004: 模型抽象层 [P0]

**描述**: 统一的多模型 Provider 抽象。

**验收标准**:
- [ ] 内置 Provider: OpenAI/Anthropic/Google/Azure/Bedrock/Ollama/llama.cpp/vLLM + 任意 OpenAI 兼容
- [ ] 统一接口: chat(messages, tools, config) -> stream<chunk>
- [ ] 自动适配: 流式协议/工具调用协议/系统消息位置/stop 序列/token 计数
- [ ] 模型路由: 按任务类型/成本/延迟自动选择
- [ ] Fallback: 主模型失败自动切换到备选链
- [ ] 成本控制: 会话级+日级+项目级预算

> **v0.1 落地范围澄清 (v2.4)**: 上述全量 Provider 适配器为长期目标 (对应 REQ-PROVIDER-001~004)。**v0.1 仅落地 5 个 Provider**: OpenAI / Anthropic / Google / Ollama / 任意 OpenAI 兼容端点 (作为一项通用 Adapter)。Azure / Bedrock / Mistral / Cohere / DeepSeek / Grok / OpenRouter / llama.cpp / vLLM / LM Studio 等在 v0.2+ 增补，自定义接入 SDK 在 v0.3。Adapter 契约与能力自描述 (REQ-PROVIDER-002) 在 v0.1 已需具备以支撑上述 5 个 Provider 的统一抽象。

#### REQ-TOOL-005: 审计日志 [P1]

**描述**: 所有工具调用记录到审计日志。

**验收标准**:
- [ ] 记录: 时间/调用方/入参摘要/结果摘要/是否人工批准/耗时
- [ ] append-only 写入
- [ ] 可选签名防篡改
- [ ] 支持导出 (JSONL/CSV)

#### REQ-TOOL-006: 自定义工具注册 [P1]

**描述**: 用户可用 TS/Python/Shell 定义工具。

**验收标准**:
- [ ] JSON Schema 描述入参/出参
- [ ] 声明风险等级/超时/是否流式
- [ ] 进入同一 Registry，统一权限审计
- [ ] 支持版本化和热重载

---

### 3.4 对话与交互需求

#### REQ-CHAT-001: 流式对话 [P0]

**描述**: LLM 回复实时流式渲染。

**验收标准**:
- [ ] Markdown 渲染 (代码高亮/表格/列表)
- [ ] 工具调用折叠/展开 (入参/出参/耗时)
- [ ] Diff 预览 (代码修改前后对比)
- [ ] 停止按钮: 随时停止生成
- [ ] 重新生成: 重新生成当前回复

#### REQ-CHAT-002: 动态结果调整 [P0] (核心亮点)

**描述**: 任何时候都可修改对话/工具结果/Agent 决策。

**验收标准**:
- [ ] **消息编辑**: 编辑已发送的用户消息或 Agent 回复，从此处继续
- [ ] **工具结果修改**: 修改工具返回结果后继续执行
- [ ] **决策干预**: 修改 Agent 下一步选择的工具或参数
- [ ] **上下文注入**: 在任意步骤注入额外上下文信息
- [ ] **分支探索**: 从历史某步 fork 新会话探索不同路径
- [ ] **回退重试**: 回退到某步，修改输入后重新执行
- [ ] UI: 点击任意步骤 → 展开详情 → 编辑 → 从此处继续
- [ ] 快捷键: Ctrl+Z 回退 / Ctrl+B 分支
- [ ] 命令: `/retry [step_id]` `/edit [step_id]` `/branch [step_id]`
- [ ] 所有调整记录到会话历史，可追溯

#### REQ-CHAT-003: Slash Commands [P0]

**描述**: 内置 + 自定义斜杠命令。

**验收标准**:
- [ ] 内置 16+ 命令: /help /clear /model /config /history /replay /diff /undo /checkpoint /export /profile /mcp /skill /agent /branch /retry
- [ ] 用户自定义命令: `.opencoding/commands/*.md`
- [ ] 命令支持参数化
- [ ] 命令支持链式调用
- [ ] 命令可绑定快捷键
- [ ] 命令面板 (Ctrl+Shift+P) 暴露所有命令

#### REQ-CHAT-004: @提及系统 [P1]

**描述**: @文件/@符号/@命令/@Agent 精确引用。

**验收标准**:
- [ ] @文件: 自动补全项目文件路径
- [ ] @符号: 自动补全类/函数/变量
- [ ] @命令: 触发 Slash Command
- [ ] @Agent: 引用 Sub-Agent
- [ ] 实时模糊搜索 + 预览

#### REQ-CHAT-005: 多会话管理 [P1]

**描述**: 标签页式多会话并存。

**验收标准**:
- [ ] 标签页: 新建/关闭/切换/拖拽排序
- [ ] 会话搜索: 全文搜索历史会话
- [ ] 会话标签: 手动添加标签分类
- [ ] 会话收藏: 重要会话标记
- [ ] 会话归档: 完成/废弃的会话归档
- [ ] 会话分支树: 可视化展示分支关系

#### REQ-CHAT-006: 多模态输入 [P1]

**描述**: 支持图片/文件等多种输入方式。

**验收标准**:
- [ ] 粘贴图片到输入框
- [ ] 拖拽文件到输入框
- [ ] 截图标注后发送
- [ ] 支持的图片格式: PNG/JPG/GIF/WebP
- [ ] 图片作为上下文发送给多模态模型

#### REQ-CHAT-007: Diff 交互 [P1]

**描述**: 代码修改以 Diff 形式展示，逐块接受/拒绝。

**验收标准**:
- [ ] 并排/统一两种 diff 视图
- [ ] 逐块接受/拒绝按钮
- [ ] 全部接受/全部拒绝
- [ ] 修改块内可直接编辑
- [ ] 与编辑器联动，点击跳转到对应位置

---

### 3.5 持久化与数据管理需求

#### REQ-DATA-001: SQLite 全量持久化 [P0] (核心亮点)

**描述**: 所有数据通过 SQLite 数据库存储。

**验收标准**:
- [ ] 会话元数据 (sessions 表)
- [ ] 消息记录 (messages 表)
- [ ] 工具调用记录 (tool_calls 表)
- [ ] Loop 执行追踪 (loop_steps 表)
- [ ] 记忆数据 (memories 表)
- [ ] 配置数据 (configs 表)
- [ ] Skills 定义 (skills 表)
- [ ] MCP Server 配置 (mcp_servers 表)
- [ ] Sub-Agent 定义 (sub_agents 表)
- [ ] 自定义命令 (commands 表)
- [ ] Profile 定义 (profiles 表)
- [ ] Hooks 定义 (hooks 表)
- [ ] 审计日志 (audit_log 表, append-only)
- [ ] 模型调用记录 (model_calls 表)
- [ ] 检查点数据 (checkpoints 表)
- [ ] 索引元数据 (index_meta 表)
- [ ] WAL 模式，支持并发读写
- [ ] 外键约束保证数据完整性
- [ ] 自动定期备份

> **表范围澄清 (v2.4)**: 全景数据库共 **20 张表** (含 v2.4 新增 config_history / goals / scheduled_tasks / prompt_templates / providers)。**v0.1 仅落地 12 张核心表**: sessions / messages / tool_calls / loop_steps / configs / config_history / mcp_servers / profiles / audit_log / model_calls / checkpoints / providers；其余表 (memories / skills / sub_agents / commands / hooks / goals / scheduled_tasks / prompt_templates / index_meta) 随对应能力在 v0.2~v0.4 经 schema 迁移系统增量建表 (见 REQ-DATA-005)。本 REQ 的验收标准描述全景表清单，v0.1 验收时仅校验已启用的 12 张。

#### REQ-DATA-002: 配置数据库化 [P0] (核心亮点)

**描述**: 配置从 YAML 文件迁移到 SQLite 数据库。

**验收标准**:
- [ ] 所有配置项存储在 SQLite 中
- [ ] 提供配置导入/导出为 YAML 的能力 (兼容旧格式)
- [ ] 配置变更历史版本化 (config_history 表)
- [ ] 配置回滚到历史版本
- [ ] 配置热加载: 修改即时生效
- [ ] 多级配置优先级: CLI > 会话 > 项目 DB > Profile > 全局 DB > 默认

#### REQ-DATA-003: 会话持久化 [P0]

**描述**: 完整保存会话数据，支持恢复和回放。

**验收标准**:
- [ ] 保存完整消息序列
- [ ] 保存 Prompt 快照
- [ ] 保存上下文快照
- [ ] 保存 Loop Trace
- [ ] 保存检查点
- [ ] 崩溃自动恢复 (检测未正常关闭的会话)
- [ ] 会话可归档/搜索/恢复

#### REQ-DATA-004: 向量索引持久化 [P1]

**描述**: 代码库向量索引持久化到本地。

**验收标准**:
- [ ] 向量数据持久化 (sqlite-vec / LanceDB)
- [ ] 增量更新: 文件变更触发增量重索引
- [ ] 索引版本与代码库 commit 绑定
- [ ] 多项目索引隔离

#### REQ-DATA-005: 数据库迁移系统 [P1]

**描述**: 数据库 schema 版本化管理与自动迁移。

**验收标准**:
- [ ] Schema 版本号记录
- [ ] 启动时自动检测并执行迁移
- [ ] 迁移脚本可回滚
- [ ] 迁移前自动备份

---

### 3.6 配置化与自定义需求

#### REQ-CFG-001: 三层配置暴露 [P0] (核心亮点)

**描述**: 新手/进阶/专家三层配置界面。

**验收标准**:
- [ ] 新手层: 仅暴露模型选择 + 风格预设 + 语言
- [ ] 进阶层: Profile/Skill/MCP/工具白名单结构化设置
- [ ] 专家层: 全量 YAML/JSON 编辑器 + Schema 校验
- [ ] 三层可随时切换
- [ ] 高层修改自动同步到底层

#### REQ-CFG-002: Profile 系统 [P1]

**描述**: 完整工作环境预设的一键切换。

**验收标准**:
- [ ] Profile 包含: 模型/Persona/Skills/MCP/工具/权限/UI 偏好
- [ ] 多 Profile 共存，一键切换
- [ ] Profile 继承 (extends)
- [ ] Profile 导出/导入/分享
- [ ] Profile 版本化

#### REQ-CFG-003: 配置项全量暴露 [P0] (核心亮点)

**描述**: 所有变量、参数都通过配置对外暴露。

**验收标准**:
- [ ] 模型域: 20+ 配置项 (Provider/路由/预算/回退/温度/…)
- [ ] 提示词域: 15+ 配置项 (分层/模板/模型适配/调试/…)
- [ ] 上下文域: 25+ 配置项 (来源权重/压缩/检索/记忆/…)
- [ ] 循环域: 20+ 配置项 (迭代/子循环/HITL/检查点/…)
- [ ] 工具域: 15+ 配置项 (启停/权限/沙箱/超时/…)
- [ ] MCP 域: 10+ 配置项 (Server/transport/健康检查/…)
- [ ] 外观域: 20+ 配置项 (主题/布局/快捷键/字体/…)
- [ ] 每个配置项有: 名称/描述/类型/默认值/校验规则
- [ ] 配置变更即时生效 (热加载)

#### REQ-CFG-004: 配置搜索与校验 [P1]

**描述**: 全文搜索配置项 + 实时 Schema 校验。

**验收标准**:
- [ ] 搜索所有配置项名称和描述
- [ ] 搜索结果高亮 + 快速跳转
- [ ] 配置修改实时 JSON Schema 校验
- [ ] 错误提示精确到字段
- [ ] 配置 diff: 变更前后对比

#### REQ-CFG-005: 配置兼容导入 [P1]

**描述**: 兼容主流竞品配置格式。

**验收标准**:
- [ ] 导入 OpenAI API 配置
- [ ] 导入 Anthropic API 配置
- [ ] 导入 OpenRouter 配置
- [ ] 导入 Claude Desktop MCP 配置
- [ ] 导入 Cursor MCP 配置
- [ ] 导入 Cline MCP 配置
- [ ] 导入失败时给出明确错误提示

#### REQ-CFG-006: 主题系统 [P1]

**描述**: 丰富的主题支持。

**验收标准**:
- [ ] 内置 10+ 主题
- [ ] 自定义主题: JSON 定义色板
- [ ] 语法高亮/UI/终端三套颜色同步
- [ ] 跟随系统深浅色
- [ ] 主题可在 Profile 中预设

---

### 3.7 扩展与生态需求

#### REQ-EXT-001: MCP 一等公民支持 [P0] (核心亮点)

**描述**: 完整 MCP Client 实现。

**验收标准**:
- [ ] 支持 stdio / SSE / HTTP 三种 transport
- [ ] UI 化管理: 添加/编辑/启停 MCP Server
- [ ] 配置存储在数据库
- [ ] 健康检查 + 自动重连
- [ ] 工具合并: MCP 工具与内置工具统一 Registry
- [ ] 支持 Resources + Prompts 消费
- [ ] 错误隔离: MCP Server 崩溃不影响主进程

#### REQ-EXT-002: Hooks 系统 [P1] (核心亮点)

**描述**: 全生命周期 Hook 点。

**验收标准**:
- [ ] 13+ Hook 点: session_start/end, pre/post_plan, pre_act, post_observe, on_tool_call/result, on_file_change, on_test_fail, on_task_complete, pre/post_model_call, on_cost_warning
- [ ] Hook 脚本支持 TS/Python/Shell
- [ ] pre_* Hook 可拦截并改写
- [ ] post_* Hook 可改写结果
- [ ] Hook 失败不中断主循环 (可配置)
- [ ] Hook 配置存储在数据库

#### REQ-EXT-003: Skills 系统 [P1]

**描述**: 可复用 Prompt + 工作流封装。

**验收标准**:
- [ ] 内置 20+ Skills
- [ ] 用户可创建/分享/安装 Skills
- [ ] Skill 声明前置依赖
- [ ] 可被命令/快捷键/Agent 自动调用
- [ ] Skills 配置存储在数据库

#### REQ-EXT-004: 插件系统 [P1]

**描述**: 沙箱化第三方插件。

**验收标准**:
- [ ] 形态: npm 包 / 本地目录 / WASM 模块
- [ ] 注册: 工具/命令/Skills/Hooks/UI 面板/设置项/Persona
- [ ] 拦截器: Loop 各阶段注入逻辑
- [ ] 沙箱: 隔离 Worker + 权限声明
- [ ] 生命周期: install→enable→configure→run→disable→uninstall
- [ ] SDK: TS SDK + 脚手架工具
- [ ] 市场: 内置插件市场入口

---

### 3.8 数据迁移与同步需求

#### REQ-MIG-001: 一键导出 [P1] (核心亮点)

**描述**: 所有数据可一键导出。

**验收标准**:
- [ ] 完整导出: `.opencoding-bundle.zip` 包含全部数据
- [ ] 配置导出: Profile YAML/JSON
- [ ] 会话导出: JSON/Markdown/重放包
- [ ] 记忆导出: JSONL
- [ ] 审计导出: JSONL/CSV
- [ ] 导出包含 manifest (版本/来源/时间/清单)
- [ ] 导出进度显示

#### REQ-MIG-002: 一键导入 [P1]

**描述**: 导入导出的数据包。

**验收标准**:
- [ ] 解包合并到当前环境
- [ ] 冲突策略: skip/overwrite/rename
- [ ] 导入前预览 (将导入什么)
- [ ] 导入后验证 (数据完整性)

#### REQ-MIG-003: 竞品格式转换 [P1]

**描述**: 兼容主流竞品数据格式。

**验收标准**:
- [ ] 导入 Claude Code 会话
- [ ] 导入 Cline 会话
- [ ] 导入 Aider 会话
- [ ] 导入失败给出明确提示

#### REQ-MIG-004: 跨平台同步 [P2]

**描述**: 可选的云同步。

**验收标准**:
- [ ] 支持 WebDAV/S3/Git 仓库
- [ ] 端到端加密
- [ ] 会话数据默认不同步
- [ ] 冲突解决: 最后写入胜出/手动合并

#### REQ-MIG-005: 团队配置共享 [P1]

**描述**: Profile 作为团队配置单元发布。

**验收标准**:
- [ ] 发布 Profile 到 Git 仓库
- [ ] 一键拉取: `profile use team-frontend`
- [ ] 强制项 vs 建议项分离
- [ ] 团队基线 + 个人覆盖模式

---

### 3.9 多客户端需求

> **架构说明**: v2.2 起采用前后端分离架构，后端为无头引擎 (@opencode/core + @opencode/server)，前端为多种瘦客户端通过 JSON-RPC 2.0 Transport (HTTP/SSE、WebSocket、stdio、Electron IPC、Embedded) 连接后端。REQ-UI-001 至 REQ-UI-007 适用于 Desktop 客户端 (Electron)；REQ-UI-008 至 REQ-UI-011 定义其他客户端形态。

> **v0.1 范围收缩说明** (v2.3 新增): 根据 07-多角色审视评估报告 §1.1 (S1)，v0.1 **仅交付 Desktop 客户端 (REQ-UI-001~007)**，通过 Embedded + Electron IPC 两种 Transport 连接后端。TUI (REQ-UI-008) / Web (REQ-UI-009) / CLI (REQ-UI-010) / 自定义客户端 (REQ-UI-011) 全部降级为 v0.2+，其中 REQ-UI-008 与 REQ-UI-010 优先级由 P1 降级为 P2。服务式 (Service) 后端、HTTP/SSE/WebSocket Transport 推迟到 v0.2~v0.3。多客户端平台仍是产品长期愿景，v4.1 架构演进方向保留。

#### REQ-UI-001: 桌面应用框架 [P0]

**描述**: 原生桌面应用。

**验收标准**:
- [ ] 支持 Windows / macOS / Linux
- [ ] 原生窗口 (菜单栏/标题栏/系统托盘)
- [ ] 系统通知集成
- [ ] 文件关联 (双击打开项目)
- [ ] 单实例检测

#### REQ-UI-002: 多面板布局 [P0]

**描述**: 可自定义的多面板 UI。

**验收标准**:
- [ ] 面板: 对话/上下文/Diff/Loop trace/终端/文件树/检查器
- [ ] 预设布局: focus/dev/debug/review 四档
- [ ] 自定义布局: 拖拽/大小调整/保存
- [ ] 布局随 Profile 携带

#### REQ-UI-003: 命令面板 [P1]

**描述**: Ctrl+Shift+P 风格命令面板。

**验收标准**:
- [ ] 列出所有可用命令和操作
- [ ] 模糊搜索
- [ ] 显示快捷键
- [ ] 可执行任意命令

#### REQ-UI-004: 内嵌终端 [P1]

**描述**: 内嵌终端仿真器。

**验收标准**:
- [ ] 基于 xterm.js
- [ ] 多 Tab 支持
- [ ] 命令历史与 Agent 共享
- [ ] 输出自动采集为上下文

#### REQ-UI-005: 编辑器集成 [P1]

**描述**: 双编辑器架构 — 代码编辑器 + AI 输入编辑器 + 外部编辑器集成。详见 [08 文档 §3.3](./08-技术选型与架构方案(实施版).md)。

**验收标准**:
- [ ] **代码编辑器**: 内嵌 Monaco Editor (@monaco-editor/react)，用于资源管理器与 Diff 查看
- [ ] **AI 输入编辑器**: 内嵌 @lobehub/editor (Lexical 富文本)，用于 AI 对话输入
- [ ] AI 输入编辑器支持 /命令芯片、@文件提及、附件预览、Markdown 混排
- [ ] 语法高亮/LSP/折叠 (Monaco)
- [ ] 外部编辑器桥接 (VSCode/JetBrains)
- [ ] 光标位置同步
- [ ] 选区自动感知

#### REQ-UI-006: Onboarding Wizard [P1]

**描述**: 首次启动引导。

**验收标准**:
- [ ] 选择语言
- [ ] 配置模型 Provider
- [ ] 安装推荐 MCP Server
- [ ] 选择 Persona 风格
- [ ] 生成首个 Profile
- [ ] 可跳过，稍后配置

#### REQ-UI-007: UI 框架优先级策略 [P0] (v2.4 重置)

**描述** (v2.4 重置): **退役 LobeHub 生态** (文档 09-LobeHub生态集成方案.md 已删除；原 v2.1 LobeHub UI 优先级策略失效)。Desktop 客户端 UI 框架切换为 **Ant Design v5 + Tailwind CSS v4** 双轨：业务组件 (Table/Tree/Form/Modal/Drawer/Notification/Select/Tabs/Menu 等) 采用 antd v5 原生 API；布局/间距/色彩系统/暗色模式采用 Tailwind utility；可拖拽面板用 `react-resizable-panels 2.1`；Markdown 渲染用 `react-markdown + rehype/remark` 插件链；AI 输入编辑器用 TipTap v2 (见 REQ-UI-005)。AI Chat 业务组件 (ChatPanel/MessageList/LoopTrace 等由项目自建)。详见 [05 文档 v4.3 §4/§6](./05-技术选型文档.md)、[08 文档 v3.8 §3.2/§3.3](./08-技术选型与架构方案(实施版).md) 与 [04 文档 v4.3 §5](./04-架构设计文档.md)。

**验收标准** (v2.4 重置):
- [ ] 项目代码中不出现 `import ... from '@lobehub/*'` 与 `antd-style createTheme` 等 v2.4 退役依赖 (CI lint 规则强制)
- [ ] 业务组件 (Table/Tree/Form/Modal/Drawer/Notification/Select/Tabs/Menu/Tooltip/Dropdown) 来自 antd v5 原生 API
- [ ] 布局/间距/色彩/响应式/暗色模式用 Tailwind utility class (与 antd 经 ConfigProvider prefix 隔离)
- [ ] 三栏可拖拽面板基于 `react-resizable-panels 2.1` 实现 (替代 @lobehub/ui DraggablePanel)
- [ ] Markdown 渲染由 react-markdown + rehype-raw + rehype-highlight + remark-gfm + remark-math + rehype-katex 统一封装为 `<MarkdownRenderer>`
- [ ] AI Prompt 输入富文本编辑器基于 TipTap v2 + ProseMirror 实现 (见 REQ-UI-005)
- [ ] antd + Tailwind 共存需通过 `tailwind.config.ts` 设置 prefix 或 antd ConfigProvider 隔离，避免 utility 与 antd 内联样式冲突
- [ ] UI 框架策略 (本 REQ) 在 05 v4.3 §4 / 08 v3.8 §3.2 / 04 v4.3 §5 / coding v1.4 §9.x 中保持一致

#### REQ-UI-008: TUI 客户端 [P2]

**描述**: 终端界面客户端（基于 Ink），作为 Desktop 之外的轻量交互入口，通过 stdio Transport 连接后端引擎。v0.1 不交付，规划于 v0.2+。

**验收标准**:
- [ ] 基于 Ink (React for CLI) 渲染终端 UI
- [ ] 支持会话管理：新建/切换/搜索会话
- [ ] 支持流式对话渲染（Markdown 终端渲染）
- [ ] 支持工具调用审批（HITL 确认）
- [ ] 通过 stdio Transport 连接 @opencode/server
- [ ] 支持基础 Slash Commands
- [ ] 键盘快捷键操作

#### REQ-UI-009: Web 客户端 [P2]

**描述**: 浏览器客户端（可选），通过 HTTP/SSE Transport 连接后端，支持远程访问与团队协作场景。

**验收标准**:
- [ ] 基于 React 的浏览器 SPA
- [ ] 通过 HTTP/SSE Transport 连接 @opencode/server
- [ ] 支持远程访问（跨主机连接后端引擎）
- [ ] 支持会话/对话/工具调用审批
- [ ] 多面板布局适配浏览器视口
- [ ] 浏览器内 API Key 安全输入

#### REQ-UI-010: CLI 客户端 [P2]

**描述**: 命令行客户端（基于 Commander.js），通过 stdio Transport 连接后端，支持脚本化/自动化集成。v0.1 不交付，规划于 v0.2+。

**验收标准**:
- [ ] 基于 Commander.js 的命令行接口
- [ ] 通过 stdio Transport 连接 @opencode/server
- [ ] 支持非交互模式：`opencode run "任务描述"` 单次执行
- [ ] 支持交互模式：REPL 式持续对话
- [ ] 支持管道输入/输出（stdin/stdout JSON 流）
- [ ] 支持脚本化与 CI/CD 集成
- [ ] 退出码语义化（成功/失败/需审批）

#### REQ-UI-011: 自定义客户端 [P2]

**描述**: 用户可基于 @opencode/api 契约 + Transport 客户端包开发自定义客户端，实现个性化交互形态。

**验收标准**:
- [ ] 发布 @opencode/api 包，定义完整 JSON-RPC 契约类型
- [ ] 提供 Transport 客户端包（HTTP/SSE、WebSocket、stdio、Embedded）
- [ ] 提供客户端开发文档与示例
- [ ] 提供最小可运行的 Embedded 客户端 SDK
- [ ] 契约版本化，向后兼容

---

### 3.10 可观测与调试需求

#### REQ-OBS-001: Loop Trace [P1]

**描述**: 每步执行的完整追踪。

**验收标准**:
- [ ] 记录每步 Perceive/Act/Observe/Reflect
- [ ] 时间线视图
- [ ] 展开查看: prompt/工具调用/返回结果/耗时/成本
- [ ] 可回放: 从任意步开始重放
- [ ] 持久化到数据库

#### REQ-OBS-002: Prompt Inspector [P1]

**描述**: 完整 prompt 可视化。

**验收标准**:
- [ ] 七层洋葱模型分层展示
- [ ] 每层可展开/折叠
- [ ] 显示每层 token 占用
- [ ] 复制/导出完整 prompt
- [ ] Prompt Playground: 离线调试

#### REQ-OBS-003: Loop 调试器 [P2]

**描述**: 类 IDE 调试器体验。

**验收标准**:
- [ ] 断点: 在指定工具调用前暂停
- [ ] 单步执行
- [ ] 条件断点
- [ ] 变量查看: 上下文/工作记忆/消息历史
- [ ] 调用栈: Sub-Agent 嵌套调用栈

#### REQ-OBS-004: 成本分析仪表盘 [P1]

**描述**: 实时成本统计与分析。

**验收标准**:
- [ ] 实时累计 token/费用
- [ ] 按会话/项目/日/模型维度统计
- [ ] 预算使用百分比
- [ ] 超预算告警
- [ ] 成本归因到 Loop 步骤和 Sub-Agent

---

### 3.11 安全与合规需求

#### REQ-SEC-001: API Key 安全存储 [P0]

**描述**: 密钥加密存储。

**验收标准**:
- [ ] macOS Keychain
- [ ] Windows Credential Manager
- [ ] Linux Secret Service
- [ ] 内存中最小化密钥暴露

#### REQ-SEC-002: 沙箱执行 [P0]

**描述**: 工具执行安全隔离。

**验收标准**:
- [ ] 文件操作限制在项目根 + 白名单
- [ ] 命令 allowlist + blocklist 过滤
- [ ] 网络域名白名单
- [ ] 可选 Docker/WASM 强化沙箱

#### REQ-SEC-003: 审计日志 [P1]

**描述**: 完整操作审计。

**验收标准**:
- [ ] append-only 写入
- [ ] 记录时间/操作者/操作/目标/详情
- [ ] 可选签名防篡改
- [ ] 不可删除

#### REQ-SEC-004: 遥测控制 [P1]

**描述**: 用户完全控制数据采集。

**验收标准**:
- [ ] 默认关闭
- [ ] 首次启动征询
- [ ] 仅采集匿名统计
- [ ] 不含代码/prompt/文件内容
- [ ] 完整可关
- [ ] 可查看采集内容

#### REQ-SEC-005: 供应链安全 [P1]

**描述**: 构建与依赖安全。

**验收标准**:
- [ ] 依赖锁定 (lockfile)
- [ ] SBOM 生成
- [ ] CI 中 CVE 扫描
- [ ] 构建产物签名

---

### 3.12 定时任务与调度需求 (v2.4 新增)

#### REQ-SCHED-001: 调度器核心 [P1]

**描述**: 内置 Agent 调度器，支持 cron / interval / event / once 四种触发形态 (见 01 §4.14)。

**验收标准**:
- [ ] 支持 cron 表达式 (5/6/7 段)
- [ ] 支持 interval (秒级)
- [ ] 支持 event 触发 (on_commit / on_idle / on_cost_warn)
- [ ] 支持 once 延迟执行
- [ ] 任务定义持久化到 scheduled_tasks 表；执行实例写 scheduled_task_runs
- [ ] 调度器崩溃后能从持久化状态恢复 (不丢任务、不重复执行)

#### REQ-SCHED-002: 调度任务定义与绑定 [P1]

**描述**: 定时任务支持复用 Profile / Persona / Skills / MCP 子集。

**验收标准**:
- [ ] 任务可绑定 Persona 与 Skills 子集
- [ ] 任务绑定 MCP Server 白名单 (默认仅只读)
- [ ] 任务声明独立预算上限 (不占用主会话预算)
- [ ] 任务声明 IO 模式: silent / notify / interactive

#### REQ-SCHED-003: 调度安全与速率限制 [P2]

**描述**: 防止定时任务失控。

**验收标准**:
- [ ] 默认只读权限；破坏性操作须显式声明并预先审批
- [ ] 启用周期性破坏性任务前强制一次 dry-run 预演
- [ ] 全局并发上限 + 单任务速率限制可配置
- [ ] 全量调用写入审计日志 (与手工调用同一通道)
- [ ] 失败策略可配置: retry / skip / escalate / halt

#### REQ-SCHED-004: 调度可观测 [P2]

**描述**: 调度可视化与告警。

**验收标准**:
- [ ] 调度日历视图 (下次执行预测)
- [ ] 运行历史时间线
- [ ] 失败告警经系统通知 (复用 Desktop 通知)
- [ ] 运行详情可导出

---

### 3.13 目标管理需求 (v2.4 新增)

#### REQ-GOAL-001: Goal 实体与持久化 [P1]

**描述**: 跨会话的 Goal 实体管理 (见 01 §4.15)。

**验收标准**:
- [ ] goals 表持久化目标: 标题/描述/验收标准/优先级/状态/父子/时间窗/进度
- [ ] 支持 OKR 式父子分解
- [ ] Goal 可关联会话/记忆/定时任务/GitHub Issue
- [ ] Goal 状态: backlog / active / blocked / done / abandoned

#### REQ-GOAL-002: Goal 分解工具 [P1]

**描述**: Agent 可将自然语言目标拆分为子目标 + 验收标准。

**验收标准**:
- [ ] 提供 goal_decompose 工具
- [ ] 产出子目标 + 验收标准 (可机器/人工判定)
- [ ] 结果归属到当前活跃 goal
- [ ] 分解结果可编辑 (用户可纠正)

#### REQ-GOAL-003: 跨会话续作 [P2]

**描述**: 重启会话时自动恢复活跃 goal 的上下文。

**验收标准**:
- [ ] 上下文锚点: 目标保存跨会话工作上下文快照
- [ ] 新会话启动时可列出活跃 goal
- [ ] 选择 goal 后自动 resume 锚点上下文
- [ ] Planning Loop 产出的 DAG 自动归属到活跃 goal

#### REQ-GOAL-004: 进度自评与升级 [P2]

**描述**: Agent 周期性自评目标进度。

**验收标准**:
- [ ] Reflect Loop 对照验收标准更新进度
- [ ] 进度指标: 子任务完成率 / 验收项达成率 / 自动评估分数
- [ ] 连续 K 次自评无进展 → 升级为人工介入并通知
- [ ] 自评过程写入 Loop Trace

#### REQ-GOAL-005: 里程碑与回溯 [P2]

**描述**: 目标的里程碑与历史回溯。

**验收标准**:
- [ ] 可标记关键节点为里程碑
- [ ] 回溯某 goal 的全部关联会话与变更
- [ ] 里程碑达成触发通知与可选归档

---

### 3.14 提示词管理需求 (v2.4 新增)

> **澄清**: §3.10 REQ-OBS-002 Prompt Inspector 仅负责"只读查看"。本节定义"可读可写可版本可实验"的提示词工程平台 (见 01 §4.16)。

#### REQ-PROMPT-001: 提示词模板库 [P1]

**描述**: 命名模板库，支持变量插值与条件块。

**验收标准**:
- [ ] prompt_templates 表持久化
- [ ] 变量插值 `{{var}}` 与条件块 `{{#if}}`
- [ ] 作用域: global / project / persona / session，叠加优先级
- [ ] 内置种子模板: planning / reflect / recovery / summarize / commit / pr / code_review / debug / tdd / migration (≥10)

#### REQ-PROMPT-002: 七层独立编辑 [P1]

**描述**: 七层洋葱模型每层可独立编辑。

**验收标准**:
- [ ] 每层独立编辑、单独版本化、单独 diff
- [ ] 保留默认层并支持 Layer override
- [ ] 编辑后即时热加载

#### REQ-PROMPT-003: 模型适配变体 [P2]

**描述**: 同一模板声明多模型变体。

**验收标准**:
- [ ] 按 Provider 自动选择变体 (Anthropic system-as-role / OpenAI system message / 本地模型限制)
- [ ] 变体缺失时回退到默认变体并告警
- [ ] 变体缓存避免重复渲染

#### REQ-PROMPT-004: 版本化与回滚 [P2]

**描述**: 模板变更版本化。

**验收标准**:
- [ ] 每次修改生成版本快照
- [ ] 可 diff / 回滚 / 标记 released
- [ ] 企业可锁定某些层为只读 (合规)

#### REQ-PROMPT-005: Prompt Playground [P1]

**描述**: 离线调试模板。

**验收标准**:
- [ ] 选模板 → 注入变量 → 调用模型 → 查看输出 (不触发真实 Loop)
- [ ] 多模板并排对比输出
- [ ] 调用计入审计但可标"调试"避免污染主统计

#### REQ-PROMPT-006: A/B 实验 [P2]

**描述**: 两版本按比例分流对比。

**验收标准**:
- [ ] 定义 A/B 比例 (权重)
- [ ] 指标采集: 成功率 / 成本 / 满意度
- [ ] 显著性提示 (接 §4.13 A/B 框架)
- [ ] 实验 winner 可一键发布为 released

---

### 3.15 AI Provider 抽象接入需求 (v2.4 新增)

> **澄清**: §3.3 REQ-TOOL-004 已定义"多模型 Provider 抽象"。本节针对偏补齐"全部兼容抽象接入"与"自定义接入 SDK"的细节 (见 01 §4.3.5)。v0.1 落地 5 个 Provider (OpenAI/Anthropic/Google/Ollama/任意 OpenAI 兼容)，其余 Adapter 在 v0.2+ 增补；自定义接入 SDK 主要在 v0.3。

#### REQ-PROVIDER-001: Provider Registry 与热插拔 [P1]

**描述**: 统一注册表，运行时可装载。

**验收标准**:
- [ ] providers 表持久化 Provider 配置
- [ ] 启动时按配置加载，支持运行时启用/禁用 (热插拔)
- [ ] Plugin 系统注入的 Adapter 与内置 Adapter 等同进入 Registry
- [ ] Registry 冲突检测 (重复 Adapter id)

#### REQ-PROVIDER-002: Adapter 契约与能力自描述 [P1]

**描述**: 统一 Adapter 接口与能力位。

**验收标准**:
- [ ] AIProviderAdapter 接口: chat/stream/countTokens/tools/capabilities
- [ ] 能力位: streaming/tool_call/vision/json_mode/parallel_tool/prompt_caching/thinking/system_as_role
- [ ] 缺失能力走 polyfill 并告警
- [ ] 屏蔽流式协议/工具调用协议/系统消息位置/stop 序列差异

#### REQ-PROVIDER-003: 路由 / Fallback / 计价 [P2]

**描述**: 路由与降级链。

**验收标准**:
- [ ] Router 按任务类型/成本/延迟/能力位自动选 Provider
- [ ] 主 Provider 失败沿 fallback 链降级；Ollama 作为底线
- [ ] 内置主流模型 $/Mtok 计价表；自定义 Provider 可声明计价函数
- [ ] 成本归因到调用 (写入 model_calls)

#### REQ-PROVIDER-004: 自定义接入 SDK [P2]

**描述**: 用户/企业自定义 Provider 接入。

**验收标准**:
- [ ] 发布 @opencode/ai-sdk 包，提供 AIProviderAdapter 类型与脚手架
- [ ] 自定义 Adapter npm 包经 Plugin 系统注册到 Registry
- [ ] 享受与内置 Provider 同一的调用/计费/审计/Fallback 待遇
- [ ] 企业网关支持 refresh token 借用与私有端点

---

## 4. 非功能需求

### 4.1 性能

| 指标 | v0.1 目标 | v1.0 目标 | 测量方法 |
|------|-----------|-----------|----------|
| 冷启动时间 | < 3s (SSD) | < 2s (SSD) | 从点击图标到 UI 可交互 |
| 10 万文件首索引 | N/A (v0.1 不索引) | < 90s | 标准测试仓库 |
| 增量索引 | N/A (v0.1 不索引) | < 8s | 单文件变更后 |
| 空闲内存 | < 400MB | < 300MB | 无会话运行 |
| 单会话内存 | < 1.5GB | < 1GB | 50 轮对话后 |
| 流式首字延迟 | < 800ms | < 500ms | 从发送到首个 token |
| 安装包大小 | < 50MB (Electron, v2.4 修正) | < 30MB (Electron, 优化后) | 压缩后；v2.4 修正陈旧的 Tauri 标注，与 §1.1/§3.9 Electron 架构一致。注：v0.1 基线放宽至 50MB 以兼容三平台原生模块 (monaco/xterm/better-sqlite3/isolated-vm) |

### 4.2 可靠性

| 指标 | 目标 |
|------|------|
| 崩溃恢复 | 自动恢复未完成会话，数据不丢失 |
| 数据备份 | 每 30 分钟自动备份 SQLite |
| 错误处理 | 所有错误有用户可理解的提示 |
| 离线可用 | 本地模型 + 本地索引可离线工作 |

### 4.3 可用性

| 指标 | 目标 |
|------|------|
| 首次任务完成时间 | < 5 分钟 (含 Onboarding) |
| 常用操作步骤 | < 3 步 |
| 错误恢复指引 | 每个错误提供解决方案建议 |
| 键盘可达性 | 所有操作可通过键盘完成 |

### 4.4 兼容性

| 平台 | 最低版本 |
|------|----------|
| Windows | Windows 10 (build 1809+) |
| macOS | macOS 12 (Monterey) |
| Linux | Ubuntu 22.04 / Debian 12 / Fedora 38 |

### 4.5 国际化

| 语言 | 版本 | 覆盖范围 |
|------|------|------|
| 英语 (en-US) | v0.1 | 完整 UI + 错误消息 + 文档 |
| 简体中文 (zh-CN) | v0.1 | 完整 UI + 错误消息 + 文档 |
| 日语 (ja-JP) | v1.0 | 完整 UI |
| 社区贡献 | v1.0+ | 通过 Crowdin/GitHub 接受社区翻译 |

**i18n 技术细节**:
- 使用 ICU MessageFormat 处理复数/性别/格式化
- 日期/时间/数字按 locale 自动格式化 (Intl API)
- 从 v0.1 起代码即 i18n-ready (所有字符串通过 `t()` 函数)
- RTL 语言 (阿拉伯语等) 延后到 v1.5+ 评估

---

## 5. 需求优先级矩阵

### 5.1 优先级定义

| 优先级 | 定义 | 不交付的影响 |
|:---:|------|------|
| **P0** | MVP 必须交付，v0.1 完成 | 产品不可用 |
| **P1** | 重要功能，v0.2-v0.3 完成 | 竞争力显著不足 |
| **P2** | 增强功能，v0.4-v0.5 完成 | 体验不完整 |
| **P3** | 远期规划，v1.0+ | 锦上添花 |

### 5.2 P0 需求清单 (v0.1 MVP) — 共 19 项

> **裁剪策略**: 仅保留 Agent 核心循环 + 基础工具 + 流式对话 + SQLite 持久化 + 核心配置 + MCP 扩展 + 桌面框架 + 基础安全。Profile/Hooks/导入导出/高级上下文功能降级到 v0.2+。

| 编号 | 需求 | 域 | 保留理由 |
|------|------|-----|------|
| REQ-AGENT-001 | PAOR 主循环 | Agent | 核心引擎，产品立身之本 |
| REQ-AGENT-002 | Planning Loop | Agent | 复杂任务必需，无规划=高级 Chat |
| REQ-TOOL-001 | 内置工具集 | 工具 | Agent 执行能力的基础 |
| REQ-TOOL-002 | 权限网关 | 工具 | 安全底线，不可省略 |
| REQ-TOOL-004 | 模型抽象层 | 工具 | 多模型支持是差异化核心 |
| REQ-CHAT-001 | 流式对话 | 对话 | 基础交互体验 |
| REQ-CHAT-002 | 动态结果调整 | 对话 | 核心亮点功能 |
| REQ-CHAT-003 | Slash Commands | 对话 | 命令行式高效交互 |
| REQ-DATA-001 | SQLite 全量持久化 | 数据 | 核心亮点，数据主权基础 |
| REQ-DATA-002 | 配置数据库化 | 数据 | 核心亮点，配置即产品 |
| REQ-DATA-003 | 会话持久化 | 数据 | 会话恢复与审计基础 |
| REQ-CFG-001 | 三层配置暴露 | 配置 | 核心亮点，降低配置门槛 |
| REQ-CFG-003 | 配置项全量暴露 | 配置 | 核心亮点，高度可定制 |
| REQ-EXT-001 | MCP 一等公民 | 扩展 | 工具生态基础 |
| REQ-UI-001 | 桌面应用框架 | 桌面 | 桌面端基础 |
| REQ-UI-002 | 多面板布局 | 桌面 | 多面板工作区 |
| REQ-UI-007 | UI 框架优先级策略 | 桌面 | v2.4 重置：退役 LobeHub UI；统一 Ant Design v5 + Tailwind v4 技术栈 (TipTap v2 + react-markdown + react-resizable-panels) |
| REQ-SEC-001 | API Key 安全存储 | 安全 | 安全底线 |
| REQ-SEC-002 | 沙箱执行 | 安全 | 安全底线 |

---

## 6. MVP 范围定义

### 6.1 MVP (v0.1) 范围

**包含**:
- 桌面应用 (Windows/macOS/Linux)
- PAOR 主循环 + Planning 子循环
- 5 个模型 Provider (OpenAI/Anthropic/Google/Ollama/OpenAI 兼容)
- 内置工具集 (18 工具)
- 权限网关 (四级分级 + 基础确认)
- SQLite 全量持久化 (所有数据)
- 流式对话 + 动态结果调整
- Slash Commands
- MCP Client
- 三层配置暴露 + 全量配置项
- 多面板布局
- API Key 安全存储 + 基础沙箱

**不包含 (延后到 v0.2+)**:
- 代码库语义索引 (向量/FTS) → v0.2
- 混合检索 (仅文件搜索) → v0.2
- 上下文压缩 (仅简单截断) → v0.2
- 记忆系统 → v0.2
- 多源上下文采集 (仅基础上下文) → v0.2
- Sub-Agent → v0.3
- Recovery Loop / Verification Loop → v0.2
- HITL 高级审批模式 → v0.2
- Profile 系统 → v0.2
- Hooks 系统 → v0.2
- 插件系统 + 插件市场 → v0.3
- Skills 系统 → v0.3
- 一键导出导入 → v0.2
- Onboarding Wizard → v0.2
- 命令面板 → v0.2
- 内嵌终端 → v0.2
- Diff 交互 → v0.2
- @提及系统 → v0.2
- 多会话管理 → v0.2
- Loop Trace 调试器 → v0.2 (v2.4 从 v0.3 提前，见 doc01 §6.2)
- Prompt Inspector (只读) → v0.2 (v2.4 从 v0.3 提前)
- 成本分析仪表盘 → v0.2
- 自定义工具 → v0.3
- 提示词管理 (模板/版本/Playground) → v0.2
- 提示词管理 (A/B 实验) → v0.4
- Provider 抽象接入 SDK (企业自定义) → v0.3
- 目标管理 (Goal System) → v0.3
- 定时任务 (调度系统) → v0.4
- 外部编辑器桥接 → v0.4
- 跨平台同步 → v0.5
- 团队配置共享 → v0.5
- i18n (仅中英文 UI) → v0.1
- a11y 完整支持 → v0.3

### 6.2 MVP 成功指标

#### 北极星指标

| 指标 | 目标 | 说明 |
|------|------|------|
| **周活跃用户 (WAU)** | > 500 (发布后 4 周) | 核心增长指标 |
| **任务成功率** | > 60% | 用户发出任务到 Agent 成功完成的比例 |
| **首周留存率** | > 35% | 安装后 7 天仍在使用的用户比例 |
| **GitHub Stars** | > 2000 (发布后 4 周) | 开源社区关注度 |

#### 质量指标

| 指标 | 目标 |
|------|------|
| 能完成典型重构任务 | 成功率 > 60% |
| 能完成典型调试任务 | 成功率 > 50% |
| 崩溃率 | < 5% |
| 单任务平均成本 | < $1.0 |
| P0 Bug 数 | 0 (发布时) |

#### 资源估算 (v0.1 MVP)

| 角色 | 人数 | 人月 | 关键产出 |
|------|:---:|:---:|------|
| Rust 核心开发 | 1-2 | 3 | PAOR 引擎 / SQLite 持久化 / MCP Client / 权限网关 |
| 前端开发 (React/TS) | 1-2 | 3 | 流式对话 / 配置界面 / 多面板布局 |
| 全栈/Electron | 1 | 2 | 桌面框架集成 / IPC / 构建流水线 |
| 产品/测试 | 1 | 2 | 需求验证 / 测试用例 / 文档 |
| **合计** | **4-6** | **~10 人月** | v0.1 MVP 交付 |

---

## 8. 风险登记册

### 8.1 技术风险

> **v2.3 新增说明**: 根据 07-多角色审视评估报告 §4.4 (M10)，新增 R14~R17 共 4 项前后端分离架构相关技术风险，覆盖 JSON-RPC 序列化开销、isolated-vm V8 耦合、monorepo 构建复杂度、better-sqlite3 跨 Worker 限制。

| # | 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|---|------|:---:|:---:|------|:---:|
| R1 | Rust 开发人员难招/培养周期长 | 高 | 高 | v0.1 核心团队至少 1 名有 Rust 经验；提供内部培训材料 | Tech Lead |
| R2 | LLM API 不稳定/模型退市导致 Provider 不可用 | 中 | 高 | 多 Provider 抽象层 + Fallback 链 + 本地模型 (Ollama) 作为底线 | 架构师 |
| R3 | SQLite WAL 并发写入在高负载下成为瓶颈 | 中 | 中 | WAL 检查点策略调优 + 写入批量合并 + 监控写入队列长度 | 架构师 |
| R4 | Electron 跨平台兼容性与包体积问题 | 中 | 中 | 三平台 CI 全覆盖；优化打包配置控制体积；渐进式原生模块加载 | 桌面开发 |
| R5 | 代码索引大项目的性能达不到预期 | 中 | 中 | 增量索引 + 懒加载语法文件 + 文件过滤 (gitignore) | 索引开发 |
| R6 | MCP Server 协议版本不兼容 | 低 | 中 | 版本协商 + 兼容性测试矩阵 (top 20 MCP Servers) | MCP 开发 |
| R13 | 前后端分离架构复杂度：JSON-RPC Transport 层增加调试与排错复杂度 | 中 | 中 | 统一 Transport 抽象层 + 结构化日志 + 请求/响应追踪 ID + 开发态调试工具 | 架构师 |
| R14 | JSON-RPC 序列化开销导致 Loop 延迟超标 (前后端分离架构风险) | 中 | 中 | v0.1 嵌入式模式允许绕过 L4 Transport 直连 L5 后端 (经 L3 类型契约约束)；性能基线测试覆盖 agent.run 端到端延迟 P99；必要时引入二进制编码 (MessagePack) 替代 JSON | 架构师 |
| R15 | isolated-vm V8 版本耦合导致 Electron 升级阻断 (前后端分离架构风险) | 中 | 高 | isolated-vm 需与 Electron V8 严格匹配，每次 Electron 升级需 electron-rebuild；准备 worker_threads 回退方案作为 Plan B；CI 增加 isolated-vm 编译产物校验 | Tech Lead |
| R16 | 多包 monorepo 构建复杂度增加交付风险 (前后端分离架构风险) | 中 | 中 | Turborepo 2.x + npm workspaces 增量构建；准备回退至纯 npm workspaces 方案；08 §9 增加 turbo.json 示例配置与 Electron + Turborepo 集成已知问题清单 | 构建工程师 |
| R17 | better-sqlite3 跨 Worker 访问限制影响并发设计 (前后端分离架构风险) | 高 | 中 | better-sqlite3 同步 API 无法跨 Worker Threads 共享连接句柄；v0.1 采用单 Worker 持有写入连接 + 各 Worker 独立只读连接策略；写入经主进程 MessagePort 转发 | 架构师 |

### 8.2 市场风险

> **v2.3 新增说明**: 根据 07-多角色审视评估报告 §4.4 (M10)，新增 R18 评估 v0.1 范围收缩对多客户端早期用户的影响。

| # | 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|---|------|:---:|:---:|------|:---:|
| R7 | 用户迁移意愿低 (习惯 Claude Code/Cursor) | 高 | 高 | 明确的迁移工具 + 差异化功能 (动态调整/配置化) 作为钩子 | PM |
| R8 | 竞品快速跟进 (Claude Code 开源或 Cursor 增加类似功能) | 中 | 高 | 保持开源社区活跃度 + 插件生态锁定 + 快速迭代节奏 | CEO |
| R9 | 开源社区参与度低 (贡献者/插件作者少) | 中 | 中 | 良好的 CONTRIBUTING 指南 + Issue 标签体系 + 贡献者激励计划 | PM |
| R10 | LLM 成本波动导致用户使用成本不可控 | 低 | 中 | 本地模型支持 + 成本仪表盘 + 预算上限硬性约束 | 产品 |
| R18 | v0.1 收缩范围导致多客户端早期用户流失 (前后端分离架构风险) | 中 | 低 | 公开 v0.2 路线图明确 TUI/CLI 交付时间；v0.1 提供 @opencode/api 契约包便于社区预研自定义客户端；GitHub Releases 与 README 标注 v0.1 仅 Desktop；早期用户反馈渠道引导至 v0.2 优先级投票 | PM |

### 8.3 项目风险

| # | 风险 | 概率 | 影响 | 缓解措施 | 负责人 |
|---|------|:---:|:---:|------|:---:|
| R11 | v0.1 范围再次膨胀 (feature creep) | 中 | 高 | P0 清单硬性锁定，新增需求进入 v0.2 backlog | PMO |
| R12 | 核心开发者离职 | 低 | 高 | 文档完善 + 模块化设计 + 至少 2 人交叉覆盖每个模块 | Tech Lead |

---

## 9. 需求变更流程

### 9.1 变更级别

| 级别 | 定义 | 审批 |
|:---:|------|------|
| L1 | 需求描述优化，不影响范围 | PM 自批 |
| L2 | 优先级调整，范围微调 | PM + Tech Lead |
| L3 | 新增/删除需求，影响版本计划 | PM + Tech Lead + PMO |
| L4 | 架构级变更 | 全员评审 |

### 9.2 变更记录模板

```
- 日期: YYYY-MM-DD
- 变更级别: L1/L2/L3/L4
- 变更类型: 新增/修改/删除/延期
- 涉及需求: REQ-XXX-XXX
- 变更描述:
- 变更理由:
- 影响评估: (范围/成本/时间)
- 审批人:
```

---

> **文档结束**。本文档定义产品"做成什么样才算完成"，技术实现参见《架构设计文档》与《详细设计文档》。