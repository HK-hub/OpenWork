# OpenWork Web — API 契约 (REST + WebSocket)

> **文档版本**: v2.0
> **文档类型**: API Contract
> **编写日期**: 2026-08-26
> **基线依据**: D-12（REST 控制面 + WS 流面）；所有 DTO/枚举/事件/错误码定义于 `packages/contracts`，前后端唯一事实源。

---

## 1. 通用约定

| 约定 | 规则 |
|------|------|
| 基础路径 | `/api/v1` |
| 内容类型 | `application/json; charset=utf-8` |
| 认证 | 默认无（仅绑 127.0.0.1）；设置 `OPENWORK_AUTH_TOKEN` 后全部请求需 `Authorization: Bearer <token>`，WS 握手同验 |
| 校验 | 请求体/查询参数经 Zod schema（contracts 定义）→ 自定义 `ZodValidationPipe` |
| 错误响应 | 统一包络 `{ error: { code, message, details? } }`；`code` ∈ contracts `ERROR_CODES` |
| 成功包络 | 资源直接返回对象/数组；写操作返回 `201`+资源 或 `200`+更新后资源 |
| 分页 | `?page=1&pageSize=20` → `{ items, page, pageSize, total }` |
| 幂等 | 写操作支持 `Idempotency-Key` 头（v0.1 仅 SendMessage 类操作实现） |
| 文档 | Swagger UI 挂载 `/api/docs`（@nestjs/swagger 自动生成） |

### 错误码（节选，全量在 contracts）

```typescript
export const ERROR_CODES = {
  ValidationError: 'VALIDATION_ERROR',
  Unauthorized: 'UNAUTHORIZED',
  NotFound: 'NOT_FOUND',
  PathOutsideWhitelist: 'PATH_OUTSIDE_WHITELIST',
  PermissionDenied: 'PERMISSION_DENIED',
  ToolTimeout: 'TOOL_TIMEOUT',
  ProviderUnavailable: 'PROVIDER_UNAVAILABLE',
  BudgetExceeded: 'BUDGET_EXCEEDED',
  MaxStepsReached: 'MAX_STEPS_REACHED',
  SessionNotActive: 'SESSION_NOT_ACTIVE',
  ConfigRollbackConflict: 'CONFIG_ROLLBACK_CONFLICT',
  Internal: 'INTERNAL',
} as const;
```

---

## 2. REST 资源

### 2.1 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/health` | 存活检查 `{ status:'ok', version }` |

### 2.2 项目工作区 Projects

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects` | 列表（含会话数统计） |
| POST | `/projects` | 注册项目 `{ name, rootPath, description? }`；后端 realpath 规范化 + 可读性校验 |
| GET | `/projects/:id` | 详情 |
| PATCH | `/projects/:id` | 改名/描述/archive |
| DELETE | `/projects/:id` | 注销（不删磁盘文件；有活跃会话时拒绝） |

### 2.3 会话 Sessions

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects/:projectId/sessions` | 分页列表 |
| POST | `/projects/:projectId/sessions` | 创建 `{ title?, providerId?, modelLabel?, maxSteps?, tokenBudget? }` |
| GET | `/sessions/:id` | 详情含冗余统计 |
| PATCH | `/sessions/:id` | 标题/status(暂停) |
| DELETE | `/sessions/:id` | 级联删除会话数据 |

### 2.4 消息 Messages（读为主；发送走 WS）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sessions/:id/messages` | 当前分支消息流：`?branchRoot=<messageId>&after=<seq>&limit=` |
| GET | `/sessions/:id/messages/tree` | 全量分支树（fork 视图用） |
| POST | `/sessions/:id/messages/:messageId/rerun` | **编辑重跑**：`{ content }` → fork 新分支并触发循环，返回新消息 id |

### 2.5 工具审批 ToolCalls（控制面决策）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tool-calls/:id` | 审批详情（入参全文） |
| POST | `/tool-calls/:id/decision` | `{ action: 'approve'|'reject', scope: 'once'|'session' }` |

### 2.6 工具注册表 Tools

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/tools` | 内置工具元数据：名称/权限级别/输入schema(JSON Schema 形式)/描述 |

### 2.7 Provider 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/providers` | 列表（api_key 永不下发明文，仅返回 `hasKey: boolean`） |
| POST | `/providers` | `{ name, kind, baseUrl?, apiKey?, defaultModel?, fallbackProviderId?, pricing? }` |
| PATCH | `/providers/:id` | 局部更新；apiKey 单独字段替换加密 |
| DELETE | `/providers/:id` | 被会话引用时拒绝 |
| POST | `/providers/:id/test` | 连通性探测 `{ ok, latencyMs, models? }` |

### 2.8 配置 Configs

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/configs/resolved?scope&refId` | 合并后的生效配置视图（session>project>global>默认） |
| PUT | `/configs/:scope/:key` | upsert `{ value, refId? }`（自动写 config_history） |
| GET | `/configs/history?scope&refId&key` | 变更历史分页 |
| POST | `/configs/history/:historyId/rollback` | 回滚到指定版本 |

### 2.9 统计 Stats

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/sessions/:id/stats` | 会话级 token/cost/步数/工具调用分布 |
| GET | `/stats/overview?projectId&from&to` | 按日聚合成本报表 |

---

## 3. WebSocket 协议（socket.io）

### 3.1 连接

- 命名空间 `/ws`；握手可带 `auth: { token? }`
- 房间模型：`room:{sessionId}`；客户端必须先 join 才能收该会话事件
- 断线重连由 socket.io 自动处理；重连后重新 `session.join` 并携带 `lastEventId` 补发缺口

### 3.2 Client → Server 事件

| 事件 | Payload (Zod) | 说明 |
|------|---------------|------|
| `session.join` | `{ sessionId, lastEventId? }` | 加入房间并补发游标后事件 |
| `session.leave` | `{ sessionId }` | 离开房间 |
| `chat.send` | `{ requestId, sessionId, content, attachments? }` | 发送用户消息并启动循环（**消息输入走 WS**，D-12） |
| `chat.stop` | `{ requestId, sessionId }` | 中止当前循环（REQ-HITL-001） |
| `tool.input` | `{ requestId, toolCallId, data: string \| binary }` | PTY 人工接管输入注入（D-14） |
| `ping` | `{ t }` | 心跳 |

### 3.3 Server → Client 事件

| 事件 | Payload | 说明 |
|------|---------|------|
| `ack` | `{ requestId, ok: true, data? }` / `{ requestId, ok:false, error }` | 与请求关联的回执 |
| `stream.delta` | `{ eventId, sessionId, messageId, delta }` | token 增量 |
| `message.appended` | `{ eventId, sessionId, message }` | 新消息落定（assistant 完整帧/tool 帧） |
| `loop.step` | `{ eventId, sessionId, step }` | 步迹更新（phase/status/duration） |
| `tool.status` | `{ eventId, sessionId, toolCallId, status, summary }` | 工具状态机流转 |
| `tool.output.chunk` | `{ eventId, toolCallId, chunk }` | PTY 原始输出；文本走 string 帧、VT 序列密集段走 binary 帧 |
| `permission.request` | `{ eventId, toolCallId, toolName, level, inputSummary }` | L2+ 待审批推送（决策回 REST §2.5） |
| `session.patch` | `{ eventId, session }` | 会话状态/统计变化 |
| `error` | `{ requestId?, code, message }` | 服务端主动错误 |
| `pong` | `{ t }` | 心跳应答 |

### 3.4 包络与游标

```jsonc
// 所有 server→client 事件外层包络
{
  "v": 1,
  "eventId": "evt_01J...",        // 会话内单调,用于断线补发游标
  "ts": "2026-08-26T08:00:00Z",
  "type": "stream.delta",          // ∈ contracts WS_EVENT_TYPES
  "payload": { /* ... */ }
}
```

- `eventId` 由 EventBroker 生成（内存环形缓冲 500 条/房间）；`session.join` 带 `lastEventId` 时先补发再实时；
- 二进制帧仅用于 `tool.output.chunk` 高吞吐场景，帧头 8 字节长度 + JSON 头 + raw payload。

### 3.5 序列化协议（预留）

默认 JSON 编码。socket.io-msgpack-parser 作为可选序列化器（env 开关），启用后二进制与结构化负载体积下降约 30%；contracts 不感知传输编码差异。

---

## 4. 时序示例：一次含确认的对话

```
Browser                        NestJS
   │ chat.send {req:R1}          │
   │─────────WS──────────────►   │ SendMessageCommand → LoopEngine
   │ ack {R1, messageId:M1}      │
   │◄─────────WS──────────────   │
   │ stream.delta ×N             │ LLM 流式
   │ loop.step {act}             │
   │ permission.request {T9,L2}  │ run_command 待审批
   │◄─────────WS──────────────   │
   │ POST /tool-calls/T9/decision│ REST approve once
   │────────────HTTP──────────►  │
   │ tool.status {running}       │ PTY spawn
   │ tool.output.chunk (bin) ×N  │
   │ [用户发现等待密码]           │
   │ tool.input {T9,"***"}       │ WS 输入注入
   │─────────WS──────────────►   │ pty.write → 进程继续
   │ tool.status {succeeded}     │
   │ message.appended            │ Observation 回灌
   │ ... 循环至完成               │
   │ loop.step {done}            │
   │◄─────────WS──────────────   │
```

---

## 5. 契约演进规则

1. 只增不改：新增字段必须可选；破坏性变更升 `/api/v2` 并保留 v1 一个大版本周期；
2. contracts 包为唯一事实源：禁止前端手写重复类型、禁止服务端绕过 Zod 直接裸用接口类型；
3. OpenAPI JSON 由 CI 导出存档，前后端契约 diff 进入 PR 检查。
