# OpenWork Web — 产品需求文档 (v2 基线)

> **文档版本**: v2.0
> **文档类型**: Product Requirements Document (Web 单机版)
> **编写日期**: 2026-08-26
> **基线依据**: [00-架构转向决策记录.md](./00-架构转向决策记录.md)
> **取代关系**: 取代旧文档集（01/02/03/11 等）中的产品范围定义；旧档归档不再维护

---

## 1. 产品定位

### 1.1 一句话定位

**OpenWork Web 版** 是一款开源、本地优先、运行于开发者本机的 Coding Agent Web 应用：NestJS 后端 + PostgreSQL 跑在本机，用户通过浏览器访问 `localhost`，Agent 直接读写本机项目代码，具备「感知-行动-观察」闭环、全链路落库可审计、危险操作可拦截可干预的能力。

### 1.2 核心卖点

> **看得见（全链路落库）、管得住（权限网关+人工接管）、带得走（PG 数据全量可导出）**

| 支柱 | 说明 | v0.1 |
|------|------|:---:|
| Agent 原生 | 单层主循环：感知→行动→观察，工具结果回灌自纠错 | ✅ |
| 全程可审计 | loop/tool/model 三类调用 100% 持久化到 PostgreSQL | ✅ |
| 可干预 | 停止 / 历史消息编辑重跑(fork) / 危险工具确认弹窗 | ✅ |
| 交互命令不卡死 | PTY 执行 + 人工接管输入，根治 yes/密码 hang 死 | ✅ |
| 数据主权 | 本机 PG 存储，业务配置版本化可回滚 | ✅ |
| 配置即产品 | Provider/模型/权限策略全部配置化驱动 | 🟡 基础 |

### 1.3 目标用户

| 画像 | 场景 | 占比预期 |
|------|------|:---:|
| 个人开发者（主力） | 日常编码、重构、调试、脚本自动化 | 80%+ |
| 开源贡献者 | 阅读/修改陌生代码库 | 次要 |
| 未来：团队成员 | 团队自托管版（架构预留，暂不交付） | v0.3+ |

---

## 2. v0.1 功能范围（极简内核）

### 2.1 REQ-CHAT 会话与对话

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-CHAT-001 | 流式对话 | 消息经 WebSocket 全双工通道发送与流式返回（token 级增量） | P0 |
| REQ-CHAT-002 | 多会话管理 | 会话列表/重命名/删除/按项目分组 | P0 |
| REQ-CHAT-003 | 项目注册 | 注册本机项目路径作为 Agent 工作区，路径白名单校验 | P0 |
| REQ-CHAT-004 | Markdown 渲染 | 回复渲染 Markdown + 代码高亮 | P0 |
| REQ-CHAT-005 | 输入框 | 轻量 textarea + 快捷键发送；@提及/命令芯片延后 | P1 |

### 2.2 REQ-LOOP Agent 循环

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-LOOP-001 | 单层主循环 | 组装上下文→LLM→工具→观察回灌→循环，直至无工具调用或终止条件 | P0 |
| REQ-LOOP-002 | 终止条件 | 最大步数 / token 预算上限 / 用户中止，三者任一触发即停 | P0 |
| REQ-LOOP-003 | 失败自纠错 | 工具失败/超时将错误信息作为 Observation 回给 LLM 自行处理 | P0 |
| REQ-LOOP-004 | Loop 落库 | 每步 phase/status/耗时持久化到 loop_steps 表 | P0 |

### 2.3 REQ-TOOL 工具系统

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-TOOL-001 | 内置工具集 | read_file / write_file / edit_file / delete_file / move_file / glob / grep / run_command / web_fetch / todo_write | P0 |
| REQ-TOOL-002 | 权限分级 | L0 只读自动放行 / L1 变更可配置 / L2 破坏性需确认 / L3 关键永远确认 | P0 |
| REQ-TOOL-003 | 确认机制 | L2+ 工具调用前弹窗确认/拒绝，支持「本会话内记住」 | P0 |
| REQ-TOOL-004 | 目录白名单 | 文件类工具仅允许操作已注册项目根目录内的路径 | P0 |
| REQ-TOOL-005 | PTY 命令执行 | run_command 经 node-pty 执行；默认非交互环境变量 + 超时兜底 | P0 |
| REQ-TOOL-006 | 人工接管输入 | 命令卡片提供「发送输入」，将用户键入内容注入 PTY stdin（解决 yes/密码 hang） | P0 |
| REQ-TOOL-007 | 工具审计 | 每次工具调用的入参/出参(截断策略)/耗时/审批记录落库 | P0 |

### 2.4 REQ-PROVIDER 模型接入

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-PROV-001 | Provider 抽象 | 统一 `IModelProvider` 接口 + 能力位声明（streaming/tools） | P0 |
| REQ-PROV-002 | 内置适配器 | OpenAI 兼容端点 / Anthropic / Ollama 三类 | P0 |
| REQ-PROV-003 | 密钥管理 | API Key 加密存储于 PG（本机密钥文件派生主密钥） | P0 |
| REQ-PROV-004 | 成本统计 | 按 session/日/模型 维度的 token 与费用汇总 | P0 |
| REQ-PROV-005 | Fallback 链 | 主 Provider 失败自动降级备用 Provider | P2 |

### 2.5 REQ-DATA 数据与配置

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-DATA-001 | PG 持久化 | 全部业务数据入 PostgreSQL，Drizzle schema 管理 | P0 |
| REQ-DATA-002 | 配置版本化 | configs/config_history 双表，支持 diff 与回滚 | P0 |
| REQ-DATA-003 | 审计日志 | append-only audit_log，禁止 UPDATE/DELETE（DB 权限层保证） | P0 |
| REQ-DATA-004 | 数据导出 | 会话导出 JSON/Markdown；全量数据可用 pg_dump 迁移 | P1 |
| REQ-DATA-005 | 种子用户 | users 表种子单用户；业务表可空 owner_id | P0 |

### 2.6 REQ-OBS 可观测

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-OBS-001 | 工具调用卡片 | 消息流内折叠卡片展示工具名/入参摘要/输出/耗时/状态 | P0 |
| REQ-OBS-002 | 成本面板 | 会话级 token/费用实时累计与汇总视图 | P0 |
| REQ-OBS-003 | 结构化日志 | 后端结构化日志（pino），请求级 trace id | P1 |

### 2.7 REQ-HITL 可干预

| ID | 需求 | 说明 | 优先级 |
|----|------|------|:---:|
| REQ-HITL-001 | 中止 | 任意时刻停止当前循环（WS 控制消息） | P0 |
| REQ-HITL-002 | 编辑重跑 | 从任意历史 user 消息编辑内容并 fork 重跑，原分支保留 | P0 |
| REQ-HITL-003 | 工具确认 | 见 REQ-TOOL-003 | P0 |

---

## 3. 明确延后清单（不在 v0.1）

> 这些能力在旧文档中已有描述但**语义定义不足或依赖未建好的底座**，延后至对应版本再精确定义。

| 能力 | 去向 | 延后理由 |
|------|------|----------|
| MCP Client | v0.2 | 外部进程管理/工具合并复杂度高，内核先稳 |
| Planning/Verification/Reflection/Recovery 子循环 | v0.2 | 触发条件与交互语义需重新精确定义 |
| RAG / 向量检索 / 代码索引 (pgvector) | v0.2 | 依赖索引管线与嵌入模型选型 |
| 记忆系统（工作/项目/全局三级） | v0.2 | 依赖 RAG 底座 |
| Hooks / Skills / 插件沙箱 | v0.3 | 沙箱方案需重新评估（isolated-vm 不再锁定） |
| Sub-Agent / Multi-Agent / 任务 DAG | v0.3 | 依赖主循环稳定 |
| 定时任务 SCHED | v0.3 | @nestjs/schedule 已预留，能力后置 |
| 目标管理 GOAL | v0.3 | 同上 |
| 提示词模板库 PROMPT | v0.2 | Handlebars 基础插值保留在引擎内部，模板管理系统后置 |
| Profile 系统 | v0.2 | 依赖配置域完善 |
| 内嵌终端面板 (xterm.js) | v0.2 评估 | PTY 输入接管已覆盖核心诉求 |
| TipTap 富文本输入 / @提及 / 斜杠命令面板 | v0.2 | textarea 先行 |
| 团队协作 / SSO / 审计中心化 | v1.x 团队版 | 架构预留（owner_id/users 表已就位） |
| TUI / CLI / Electron Desktop 客户端 | 无限期搁置 | 需求已移除；contracts 包保留未来扩展可能 |

---

## 4. 用户旅程（v0.1）

### 旅程 1：日常编码

```
1. 浏览器打开 localhost → 项目列表 → 选择/注册项目目录
2. 新建会话 → 输入任务描述 → Agent 开始循环
3. 消息流中观察工具调用卡片实时滚动（读文件/搜索/改码）
4. 危险操作（删除/run_command）弹出确认框 → 批准或拒绝
5. run_command 卡片出现"等待输入"时直接键入密码/yes → 进程继续
6. 任务完成 → 查看 Diff 摘要与本次 token/费用
```

### 旅程 2：走偏了就回退

```
1. 发现第 5 条消息后 Agent 方案不对
2. 定位到该条历史消息 → 点击"编辑并重跑" → 修改描述提交
3. 系统从该节点 fork 新分支重新执行，原分支完整保留
4. 分支树中自由切换查看两条路径的结果
```

### 旅程 3：换模型与查成本

```
1. 设置页 → Providers → 添加 OpenAI 兼容端点（填 base_url + key）
2. 会话创建时选择模型；主模型故障自动切 fallback
3. 成本页按 日/会话/模型 查看 token 与费用汇总
```

---

## 5. 非功能需求

| 维度 | 目标 (v0.1) |
|------|-------------|
| 启动时间 | 后端冷启动 < 3s；前端首屏 < 2s（localhost） |
| 内存占用 | 后端空闲 < 300MB |
| 流式延迟 | 首 token 延迟 = Provider 网络延迟 + <50ms 引擎开销 |
| 并发 | 单用户多会话并存；同一会话串行循环 |
| 可靠性 | 进程重启后会话状态可恢复（一切状态在 PG） |
| 安全 | 默认绑定 127.0.0.1；可选 Bearer Token；密钥加密落库；审计 append-only |
| 兼容 | Windows 10+/macOS/Linux；Chromium 内核浏览器最新两个大版本 |
| 测试 | 核心域（loop/tools/permission/repo）单元测试覆盖；HTTP 层 e2e 冒烟 |

---

## 6. 版本路线图

| 版本 | 主题 | 内容 |
|------|------|------|
| **v0.1** | 可用闭环 | 本文 §2 全部 P0/P1 |
| **v0.2** | 能力扩展 | MCP Client、RAG(pgvector)、记忆系统、Profile、Prompt 模板库、子循环(精确定义后)、xterm 面板评估 |
| **v0.3** | 生态与治理 | Hooks/Skills/插件、Sub-Agent/Multi-Agent、SCHED、GOAL、Fallback 完善 |
| **v1.x** | 团队版 | 多用户注册/OAuth/RBAC、团队自托管部署、集中审计 |

---

## 7. 成功指标 (v0.1)

- 从安装到完成第一次代码修改任务 ≤ 15 分钟（含配 Key）
- 连续 10 个真实编码任务零 hang 死（PTY 方案生效的硬指标）
- 任一工具调用可在数据库中找到完整审计记录（100%）
- 配置错误可通过 config_history 一键回滚恢复
