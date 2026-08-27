# OpenWork Web — 架构设计 (NestJS + DDD + CQRS + Clean)

> **文档版本**: v2.0
> **文档类型**: Architecture Design Document
> **编写日期**: 2026-08-26
> **基线依据**: [00-架构转向决策记录.md](./00-架构转向决策记录.md) D-01~D-15

---

## 1. 总体架构

```
┌──────────────────────────── 浏览器 ────────────────────────────┐
│  Vite SPA: React 19 + antd v5 + Tailwind v4                     │
│  Zustand(客户端态) / TanStack Query(REST 数据) / WS Client       │
└───────────────┬─────────────────────────────┬───────────────────┘
                │ REST (CRUD/控制面)           │ WebSocket 全双工 (流面)
┌───────────────▼─────────────────────────────▼───────────────────┐
│                    apps/server — NestJS 11                       │
│                                                                  │
│  ┌─ Presentation 层 ─────────────────────────────────────────┐   │
│  │ REST Controllers · DTO+ZodValidationPipe · Swagger        │   │
│  │ WsGateway (socket.io, room=sessionId, 二进制帧)            │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│  ┌─ Application 层 ──────────▼───────────────────────────────┐   │
│  │ CommandBus / QueryBus (@nestjs/cqrs)                      │   │
│  │ 用例编排: SendMessage / StopSession / ApproveToolCall ...  │   │
│  │ Ports(接口声明): IModelProvider ISessionRepository ...     │   │
│  └───────────────────────────┬───────────────────────────────┘   │
│  ┌─ Domain 层 ───────────────▼───────────────────────────────┐   │
│  │ 聚合: Session Message LoopStep ToolCall ModelCall         │   │
│  │ 领域服务: LoopEngine · ToolDispatcher · PermissionGateway │   │
│  │ Repository 接口 · 枚举常量 · 领域事件(内存)                 │   │
│  │ ★ 零外部依赖：不 import nestjs/drizzle/fs                  │   │
│  └───────────────▲───────────────────────────▲───────────────┘   │
│  ┌─ Infrastructure ─┴───────────┐  ┌────────┴────────────────┐   │
│  │ Drizzle Repository 实现      │  │ Provider Adapters        │   │
│  │ PostgreSQL 17 (+pgvector预留)│  │ openai-compat/anthropic/ │   │
│  │ PtyRunner (node-pty/ConPTY)  │  │ ollama                   │   │
│  │ FsGateway(路径白名单)        │  │ CryptoService(AES-GCM)   │   │
│  └──────────────────────────────┘  └──────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
        │                          │                    │
   本机项目目录               PostgreSQL 实例         LLM API (外网)
  (node:fs 直读,             (Docker Compose)       OpenAI/Anthropic/
   白名单约束)                                        Ollama(本地)
```

---

## 2. 分层与依赖规则 (Clean Architecture)

### 2.1 四层定义

| 层 | 目录 (`apps/server/src/`) | 职责 | 允许依赖 |
|----|---------------------------|------|----------|
| Presentation | `presentation/` | HTTP 控制器、WS 网关、DTO 校验、Swagger | Application |
| Application | `application/` | 用例编排（Command/Query Handler）、事务边界、Port 接口声明 | Domain |
| Domain | `domain/` | 聚合根、值对象、领域服务、Repository 接口、枚举/常量、领域事件 | **无外部依赖** |
| Infrastructure | `infrastructure/` | Drizzle 实现、Provider 适配器、PTY、文件网关、加密、日志 | Domain（实现其接口）、第三方库 |

### 2.2 依赖倒置（DIP）落地规则

1. **依赖方向永远指向 Domain**：`presentation → application → domain ← infrastructure`。
2. **Domain 层零框架依赖**：`domain/` 内禁止 import `@nestjs/*`、`drizzle-orm/*`、`node:fs` 等；只允许 import `packages/contracts` 与自身。
3. **接口定义在消费侧**：Application/Domain 定义 Port 接口，Infrastructure 实现 Adapter，由 NestJS DI 在组装根注入。
4. **禁止跨层直呼具体实现**：任何业务代码不得直接 import Drizzle client、openai SDK、node-pty——必须经接口。
5. **enforce 手段**：ESLint `no-restricted-imports` 按目录禁用 + `dependency-cruiser` CI 校验。

```
合法:  domain/ISessionRepository.ts  ◄── infrastructure/drizzle/DrizzleSessionRepository.ts
非法:  domain/*.ts                   ──> import { drizzle } from 'drizzle-orm'
非法:  application/*.ts              ──> import { DbSessionRepository } from 'infrastructure'
```

---

## 3. NestJS 模块划分

```
AppModule
├── ConfigModule          # @nestjs/config + 自定义 ConfigService(env→类型化配置)
├── PersistenceModule     # Drizzle client + 全部 *Repository Provider 注册
├── ProjectsModule        # 项目注册/白名单 CRUD
├── SessionsModule        # 会话 CRUD + 消息树查询
├── ChatModule            # WsGateway + SendMessage/StopSession 命令
├── AgentLoopModule       # LoopEngine + ContextAssembler + PromptBuilder
├── ToolsModule           # ToolRegistry + ToolDispatcher + 10 个内置 ToolHandler
├── PermissionModule      # PermissionGateway(L0-L3) + ApprovalService(会话级缓存)
├── AiProviderModule      # IModelProvider port + 3 个 Adapter + FallbackRouter
├── WorkspaceModule       # FsGateway(node:fs 封装,路径校验) 
├── PtyModule             # PtyRunner(node-pty 生命周期/输入注入/超时)
├── CryptoModule          # 密钥派生(scrypt) + AES-GCM 加解密
├── ObservabilityModule   # pino 结构化日志 + CostTracker + AuditService
└── EventsModule          # WsEventBroker(room 扇出/事件游标)
```

模块间通信原则：
- 同进程内一律经构造函数注入接口，**不使用全局可变单例**；
- 跨模块广播（流式事件）经 `WsEventBroker`；
- 领域事件用 `@nestjs/event-emitter` 做进程内同步分发（如 `tool.call.finished → cost.update`）。

---

## 4. CQRS 应用规范（轻量）

| 维度 | 写路径 (Command) | 读路径 (Query) |
|------|------------------|----------------|
| 入口 | CommandBus → CommandHandler | QueryBus → QueryHandler |
| 数据访问 | 聚合 + Repository 接口 | 读优化查询服务（允许绕过聚合直接构造 SQL 视图） |
| 事务 | Handler 内 `db.transaction()` 包裹 | 无 |
| 返回值 | 领域结果/ID | DTO（来自 contracts 包） |

**v0.1 Command 清单**: `RegisterProjectCommand` / `StartSessionCommand` / `SendMessageCommand` / `StopSessionCommand` / `RerunFromMessageCommand`(fork) / `ApproveToolCallCommand` / `RejectToolCallCommand` / `UpsertConfigCommand` / `RollbackConfigCommand` / `UpsertProviderCommand`

**v0.1 Query 清单**: `ListProjectsQuery` / `ListSessionsQuery` / `GetMessageTreeQuery` / `GetSessionStatsQuery` / `GetCostOverviewQuery` / `GetConfigHistoryQuery` / `ListToolsQuery`

规则：
- 不引入 EventBus 持久化 / 事件溯源 / 读写库分离（D-10）；
- Agent 流式事件不是 CQRS 事件，走 §6 的 WS 通道。

---

## 5. 关键接口契约（Ports）

> 全部接口与 DI token 定义在领域/应用层；以下为核心签名示意。命名前缀 `I`，token 常量集中管理。

```typescript
// ===== domain/ports/repository.tokens.ts =====
export const REPO_TOKENS = {
  Session: Symbol('REPO.Session'),
  Message: Symbol('REPO.Message'),
  ToolCall: Symbol('REPO.ToolCall'),
  ModelCall: Symbol('REPO.ModelCall'),
  LoopStep: Symbol('REPO.LoopStep'),
  Project: Symbol('REPO.Project'),
  Config: Symbol('REPO.Config'),
  Provider: Symbol('REPO.Provider'),
  AuditLog: Symbol('REPO.AuditLog'),
  TodoItem: Symbol('REPO.TodoItem'),
} as const;

// ===== domain/ports/session.repository.ts =====
export interface ISessionRepository {
  findById(id: SessionId): Promise<SessionAggregate | null>;
  findByProject(projectId: ProjectId, page: PageQuery): Promise<Page<SessionSummary>>;
  save(session: SessionAggregate): Promise<void>;
  delete(id: SessionId): Promise<void>;
}

// ===== domain/ports/model-provider.port.ts =====
export type ProviderKind = typeof PROVIDER_KIND[keyof typeof PROVIDER_KIND]; // 枚举见 contracts

export interface ChatRequest {
  readonly model: string;
  readonly messages: readonly LlmMessage[];
  readonly tools: readonly ToolSchema[];
  readonly signal: AbortSignal;
}
export interface IModelProvider {
  readonly kind: ProviderKind;
  capabilities(): Readonly<ProviderCapabilities>;   // 能力位: streaming/toolCall/jsonMode
  chat(req: ChatRequest): AsyncIterable<LlmStreamEvent>; // delta | tool_call | usage | done
  countTokens?(input: string): Promise<number>;
}

// ===== domain/ports/tool-handler.port.ts =====
export interface IToolHandler<TInput = unknown> {
  readonly name: TOOL_NAMES;                        // contracts 枚举
  readonly permissionLevel: PermissionLevel;        // L0-L3
  readonly inputSchema: z.ZodType<TInput>;
  describe(): ToolDescription;
  execute(input: TInput, ctx: ToolExecutionContext): Promise<ToolResult>;
}

// ===== domain/ports/workspace-gateway.port.ts =====
export interface IWorkspaceGateway {
  assertAllowed(absPath: string): void;             // 白名单校验,越界抛 DomainError
  readFile(path: string, range?: LineRange): Promise<string>;
  writeFile(path: string, content: string): Promise<WriteDiff>;
  editFile(path: string, edits: readonly EditOp[]): Promise<WriteDiff>;
  deletePath(path: string): Promise<void>;
  movePath(from: string, to: string): Promise<void>;
  glob(pattern: string, cwd: string): Promise<readonly string[]>;
  grep(pattern: RegExp, opts: GrepOptions): AsyncIterable<GrepMatch>;
}

// ===== domain/ports/pty-runner.port.ts =====
export interface IPtyRunner {
  spawn(cmd: PtyCommand): PtyProcess;               // events: data|exit|timeout
  write(processId: PtyProcessId, input: string | Uint8Array): void; // 人工接管通道
  kill(processId: PtyProcessId, signal?: string): void;
}

// ===== domain/services/loop-engine.ts (领域服务示意) =====
@injectable() // 经 Module provider 注册,此处仅示意
export class LoopEngine {
  constructor(
    private readonly sessions: ISessionRepository,
    private readonly messages: IMessageRepository,
    private readonly tools: IToolDispatcher,
    private readonly providers: IModelRouter,       // 含 fallback
    private readonly policy: ITerminationPolicy,    // 最大步数/预算/中止信号
    private readonly sink: ILoopEventSink,          // → EventBroker
  ) {}
  async run(sessionId: SessionId, seed: UserTurn): Promise<LoopOutcome> { /* PAO 循环 */ }
}
```

---

## 6. WebSocket 网关与实时管道

### 6.1 通道职责划分

| 平面 | 通道 | 内容 |
|------|------|------|
| 控制面 | REST | 项目/会话/配置/Provider CRUD、工具审批决策、统计查询 |
| 流面 | WS `/ws` | chat 发送、token 流、loop step、工具状态、PTY 输出流（二进制）、输入注入 |

### 6.2 事件流管线（以一次对话为例）

```
WS: chat.send ─► WsGateway ─► SendMessageCommand
  ─► LoopEngine.run()
       ├─ ContextAssembler 组装上下文(消息树+项目信息)
       ├─ IModelRouter.chat() ─► AsyncIterable<LlmStreamEvent>
       │     └─ 每个 delta ─► LoopEventSink ─► WsEventBroker ─► room(sessionId):
       │            stream.delta { messageId, delta }
       ├─ 解析 tool_call ─► PermissionGateway.check(level)
       │     ├─ 通过 ─► ToolDispatcher.execute(handler)
       │     └─ L2+  ─► 挂起 + ws: permission.request { toolCallId } → 等待 REST 决策
       ├─ run_command 特例:
       │     PtyRunner.spawn ─► data chunk ─► 清洗ANSI后:
       │        ├─ ws 二进制帧 tool.output.chunk (原始VT流给前端渲染)
       │        └─ 截断存入 tool_calls.output (Agent Observation)
       │     用户在卡片输入 ─► ws: tool.input ─► IPtyRunner.write() ─► 进程继续
       ├─ 观察(Observation)回灌消息列表 → 下一次模型调用
       └─ 终止条件命中(policy) ─► loop.completed ─► 汇总落库
```

### 6.3 可靠性约定

- WS 断线重连后以 `session:join { sessionId, lastEventId }` 补发游标之后的事件（EventBroker 内存环形缓冲 + PG 兜底查询）；
- 所有客户端消息携带 `requestId`，服务端回 `ack/error` 关联；
- 心跳 ping/pong 15s，30s 无响应判死。

---

## 7. 安全设计要点

| 机制 | 设计 |
|------|------|
| 网络边界 | 默认 `HOST=127.0.0.1`；设置 `OPENWORK_AUTH_TOKEN` 后开启 Bearer 校验中间件（HTTP+WS 握手同验） |
| 文件边界 | `FsGateway.assertAllowed()`：解析 realpath 后必须位于已注册项目根内；拒绝符号链接逃逸 |
| 命令安全 | L2 确认 + blocklist（`rm -rf /`、`sudo`、force push 等 L3 模式永远确认）+ PTY 输出全量审计 |
| 密钥安全 | 主密钥 = scrypt(本机密钥文件)；API Key AES-256-GCM 加密落库；日志/审计中密钥字段强制脱敏 |
| 注入防护 | 全部输入 Zod 校验；SQL 仅经 Drizzle 参数化；前端渲染 Markdown 经 rehype 白名单消毒 |
| 审计 | audit_log append-only：应用账号 REVOKE UPDATE/DELETE |

---

## 8. 强类型工程规范（强制）

### 8.1 TypeScript 配置底线

```jsonc
// tsconfig.base.json —— 全仓继承,不得放宽
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true
  }
}
```

### 8.2 编码规约（CI 卡点）

| 规则 | 说明 |
|------|------|
| 禁 `any` | ESLint `@typescript-eslint/no-explicit-any: error`；未知类型用 `unknown` + 收窄 |
| 禁非空断言滥用 | `no-non-null-assertion: error` |
| 禁悬浮 Promise | `no-floating-promises: error` |
| 枚举即常量对象 | 统一 `as const` 对象 + 派生联合类型（不用 TS enum），全部定义于 `packages/contracts` |
| 魔法字符串零容忍 | 状态/类型/事件名/错误码必须是 contracts 导出的常量成员；review + lint-plugin 检查 |
| 配置参数化 | 行为开关走 `ConfigService` 类型化读取（env schema 用 Zod 解析），禁止散落硬编码 |
| 边界校验 | HTTP DTO / WS payload / 工具入参 / Provider 响应 四类边界必须 Zod parse |
| ID 品牌化 | 领域内 `type SessionId = Brand<string,'SessionId'>`，防串参 |

```typescript
// contracts 枚举标准形态
export const SESSION_STATUS = {
  Active: 'active',
  Paused: 'paused',
  Completed: 'completed',
  Error: 'error',
  Cancelled: 'cancelled',
} as const;
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
```

---

## 9. Monorepo 目录结构

```
OpenWork/
├── apps/
│   ├── web/                          # Vite SPA
│   │   └── src/{app,pages,components,stores,api,hooks,styles}/
│   └── server/                       # NestJS
│       └── src/
│           ├── presentation/         # controllers/ gateways/ dto/ pipes/
│           ├── application/          # commands/ queries/ ports/ sagas/
│           ├── domain/               # aggregates/ services/ ports/ events/ errors/
│           ├── infrastructure/       # drizzle/ providers/ pty/ fs/ crypto/ logging/
│           ├── modules/              # §3 各 FeatureModule 装配
│           ├── config/               # env schema + typed config
│           └── main.ts
├── packages/
│   └── contracts/                    # 前后端唯一事实源
│       └── src/{enums,consts,dto,events,errors,schemas}/
├── docker-compose.yml                # postgres(+pgvector) 本地实例
├── turbo.json
├── tsconfig.base.json
└── package.json                      # npm workspaces
```

构建链路：`turbo build` = contracts(tsc) → server(nest build) → web(vite build)；生产部署时 server 可静态托管 `apps/web/dist`。

---

## 10. 关键流程时序（编辑重跑/fork）

```
用户点击历史消息"编辑并重跑"并提交新内容
  → REST POST /api/sessions/:id/messages/:messageId/rerun {content}
  → RerunFromMessageCommand:
      1. 以该消息 parent 为父插入新 user 消息(content=新内容, edited_from=旧id)
      2. 会话 current_branch 指针切换到新分支
      3. 投递 SendMessageCommand 复用主循环
  → 前端消息树按 parent_id 渲染分支,默认展示当前分支
```

---

## 11. 决策登记簿（架构层增量）

| 决策 | 内容 | 来源 |
|------|------|------|
| A-01 | WS 库选 socket.io（自动重连/room/ack/二进制/msgpack 序列化器可选），Nest 官方 adapter 支持 | D-12 |
| A-02 | 领域事件仅进程内（@nestjs/event-emitter），不持久化 | D-10 |
| A-03 | ANSI 清洗策略：PTY 原始流推前端渲染，清洗后的纯文本作为 Agent Observation 入库 | D-14 |
| A-04 | 分支模型：messages.parent_message_id 自引用树，不做独立 checkpoints 表 | D-06 |
| A-05 | isolated-vm/Worker Threads 不进入 v0.1（无插件系统；Loop 单实例足够） | D-04/D-09 |
