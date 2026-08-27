# OpenWork Web — PostgreSQL 数据库设计

> **文档版本**: v2.0
> **文档类型**: Database Design
> **编写日期**: 2026-08-26
> **基线依据**: D-02/D-03/D-11/D-15；schema 由 `apps/server/src/infrastructure/drizzle/schema/*` 用 Drizzle 定义，drizzle-kit 迁移。

---

## 1. 全局约定

| 约定 | 规则 |
|------|------|
| 主键 | `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`（应用层可用 uuid v7 生成以获得时序友好性） |
| 时间戳 | `created_at timestamptz NOT NULL DEFAULT now()`；可变表加 `updated_at`（应用层维护） |
| 时区 | 一律 `timestamptz`（UTC 存储），禁止 naive timestamp |
| 枚举 | 稳定枚举用 PG 原生 `CREATE TYPE ... AS ENUM`（Drizzle pgEnum）；易扩展枚举用 `text + CHECK` |
| 用户维度 | 业务表带 `owner_id uuid NULL REFERENCES users(id)`（D-03：v0.1 恒为种子用户，未来多用户免迁移） |
| 命名 | snake_case；布尔 `is_*`/`has_*`；外键 `<entity>_id` |
| JSON | 半结构化数据用 `jsonb`；结构稳定后不得滥用 jsonb 规避建列 |
| 删除策略 | v0.1 物理删除为主；`audit_log` 永不删除 |
| 迁移 | drizzle-kit generate → SQL 文件入库版本化；禁止手改已发布迁移 |

---

## 2. 枚举类型（PG ENUM）

```sql
CREATE TYPE session_status   AS ENUM ('active','paused','completed','error','cancelled');
CREATE TYPE message_role     AS ENUM ('user','assistant','system','tool');
CREATE TYPE message_status   AS ENUM ('complete','streaming','error');
CREATE TYPE loop_phase       AS ENUM ('perceive','act','observe');
CREATE TYPE run_status       AS ENUM ('pending_approval','approved','rejected',
                                      'running','succeeded','failed','timed_out','waiting_input');
CREATE TYPE permission_level AS ENUM ('L0','L1','L2','L3');
CREATE TYPE provider_kind    AS ENUM ('openai_compatible','anthropic','ollama');
CREATE TYPE config_scope     AS ENUM ('global','project','session');
CREATE TYPE audit_actor      AS ENUM ('user','agent','system');
```

> 与 `packages/contracts/src/enums` 一一对应，Drizzle schema 从 contracts 导入常量生成，保证单一事实源。

---

## 3. v0.1 表清单（12 张）

### 3.1 users — 用户（种子单用户）

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| username | text UNIQUE NOT NULL | 种子值 `local` |
| display_name | text NOT NULL | |
| auth_token_hash | text NULL | 可选局域网访问 Token 的 scrypt 哈希；NULL=未启用 |
| created_at / updated_at | timestamptz | |

### 3.2 projects — 注册的项目工作区

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| owner_id | uuid FK→users NULL | |
| name | text NOT NULL | 显示名 |
| root_path | text NOT NULL | 绝对路径；FsGateway 白名单依据 |
| description | text NULL | |
| status | text CHECK IN ('active','archived') DEFAULT 'active' | |
| settings | jsonb NOT NULL DEFAULT '{}' | 项目级配置覆盖入口 |
| created_at / updated_at | timestamptz | |

约束与索引：`UNIQUE(owner_id, root_path)`；`root_path` 存储前由后端做 realpath 规范化。

### 3.3 sessions — Agent 会话

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| project_id | uuid FK→projects NOT NULL | |
| owner_id | uuid FK→users NULL | 冗余存储便于未来隔离查询 |
| title | text NOT NULL DEFAULT 'New Session' | |
| status | session_status NOT NULL DEFAULT 'active' | |
| current_root_message_id | uuid FK→messages NULL | 当前分支根指针（fork 切换用） |
| provider_id | uuid FK→providers NULL | 会话使用的模型配置 |
| model_label | text NULL | 快照：模型名（provider 删除不影响历史展示） |
| max_steps | int NOT NULL DEFAULT 40 | 终止条件快照 |
| token_budget | int NULL | 预算上限（tokens），NULL=不限 |
| total_prompt_tokens / total_completion_tokens | bigint NOT NULL DEFAULT 0 | 冗余统计（增量更新） |
| total_cost_usd | numeric(12,6) NOT NULL DEFAULT 0 | 同上 |
| last_activity_at | timestamptz NOT NULL DEFAULT now() | |
| created_at / updated_at | timestamptz | |

索引：`(project_id, last_activity_at DESC)`、`(status)`。

### 3.4 messages — 消息（自引用树，支撑 fork）

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| session_id | uuid FK→sessions NOT NULL | |
| parent_message_id | uuid FK→messages NULL | 树形分支结构核心 |
| edited_from_message_id | uuid FK→messages NULL | 「编辑重跑」溯源指针 |
| seq | bigint NOT NULL | 会话内单调序号（分配即固定，分支各自延续） |
| role | message_role NOT NULL | |
| content | text NOT NULL | Markdown/纯文本 |
| tool_call_ids | uuid[] NULL | assistant 消息关联的工具调用（数组即可，无需 join 表） |
| attachments | jsonb NULL | v0.1 仅预留 |
| prompt_tokens / completion_tokens | int NOT NULL DEFAULT 0 | 该条消息产生的用量 |
| status | message_status NOT NULL DEFAULT 'complete' | |
| error_text | text NULL | |
| created_at | timestamptz | |

索引：`(session_id, parent_message_id)`、`(session_id, seq)`。

**fork 语义**：编辑重跑 = 在目标消息的 parent 下插入新 user 消息并回填 `edited_from_message_id`；旧子树保留，`sessions.current_root_message_id` 切换到新分支根。无需独立 checkpoints 表（A-04）。

### 3.5 loop_steps — 循环步迹

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| session_id | uuid FK→sessions NOT NULL | |
| step_no | int NOT NULL | 本轮运行内从 1 递增 |
| phase | loop_phase NOT NULL | |
| summary | text NULL | 引擎生成的步骤摘要 |
| context_stats | jsonb NULL | {messageCount, charCount, truncated} 等 |
| started_at / finished_at | timestamptz | finished_at NULL=进行中 |
| duration_ms | int NULL | |

索引：`(session_id, step_no)`。

### 3.6 tool_calls — 工具调用审计

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| session_id | uuid FK→sessions NOT NULL | |
| message_id | uuid FK→messages NULL | 关联 assistant 消息 |
| loop_step_id | uuid FK→loop_steps NULL | |
| tool_name | text NOT NULL | 取值 ∈ contracts TOOL_NAMES |
| permission_level | permission_level NOT NULL | 调用时判定的级别 |
| approval_scope | text CHECK IN ('once','session') NULL | L2+ 批准范围 |
| approved_by_user | boolean NOT NULL DEFAULT false | |
| status | run_status NOT NULL | |
| input | jsonb NOT NULL | 入参（密钥类字段脱敏） |
| output | jsonb NULL | 出参（截断策略：>64KB 存摘要+截断标记） |
| exit_code | int NULL | run_command 专用 |
| duration_ms | int NULL | |
| pty_process_ref | text NULL | 进行中 PTY 的进程引用（结束后清空） |
| error_text | text NULL | |
| created_at / finished_at | timestamptz | |

索引：`(session_id, created_at)`、`(tool_name, status)`。

### 3.7 model_calls — 模型调用记录

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| session_id | uuid FK→sessions NOT NULL | |
| loop_step_id | uuid FK→loop_steps NULL | |
| provider_id | uuid FK→providers NULL | |
| kind | provider_kind NOT NULL | 实际使用的 Provider 类型 |
| model | text NOT NULL | |
| is_fallback | boolean NOT NULL DEFAULT false | 是否触发降级链 |
| prompt_tokens / completion_tokens | int NOT NULL DEFAULT 0 | |
| cost_usd | numeric(12,6) NOT NULL DEFAULT 0 | 按 providers.pricing 计价 |
| latency_ms | int NULL | 首 token 延迟另存 first_token_ms |
| status | text CHECK IN ('succeeded','failed','cancelled') | |
| error_text | text NULL | |
| created_at | timestamptz | |

索引：`(session_id, created_at)`、`(model, created_at)`（成本报表）。

### 3.8 todo_items — 任务清单（todo_write 后端）

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| session_id | uuid FK→sessions NOT NULL | |
| content | text NOT NULL | |
| status | text CHECK IN ('pending','in_progress','completed','cancelled') DEFAULT 'pending' | |
| sort_order | int NOT NULL | |
| created_at / updated_at | timestamptz | |

索引：`(session_id, sort_order)`。

### 3.9 configs — 配置（作用域化 KV）

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| scope | config_scope NOT NULL | global/project/session |
| scope_ref_id | uuid NULL | project/session 的 id；global 为 NULL |
| key | text NOT NULL | 点分命名空间，如 `permission.L1.mode` |
| value | jsonb NOT NULL | |
| updated_by | audit_actor NOT NULL DEFAULT 'user' | |
| updated_at | timestamptz | |

约束：`UNIQUE(scope, scope_ref_id, key)`。读取合并顺序：session > project > global > 内置默认。

### 3.10 config_history — 配置变更历史（版本化/回滚）

| 列 | 类型 | 说明 |
|----|------|------|
| id | bigserial PK | |
| scope | config_scope NOT NULL | |
| scope_ref_id | uuid NULL | |
| key | text NOT NULL | |
| old_value | jsonb NULL | |
| new_value | jsonb NOT NULL | |
| change_source | text CHECK IN ('ui','api','rollback') NOT NULL | agent 直写配置 v0.1 禁止 |
| changed_at | timestamptz NOT NULL | |

索引：`(scope, scope_ref_id, key, changed_at DESC)`。回滚 = 将 old_value 写回 configs 并追加一条 source='rollback' 历史。

### 3.11 providers — AI Provider 注册

| 列 | 类型 | 说明 |
|----|------|------|
| id | uuid PK | |
| owner_id | uuid FK→users NULL | |
| name | text NOT NULL | 显示名 |
| kind | provider_kind NOT NULL | |
| base_url | text NULL | openai_compatible 必填 |
| api_key_encrypted | text NULL | AES-256-GCM 密文（含 iv/authTag 打包）；ollama 可空 |
| default_model | text NULL | |
| fallback_provider_id | uuid FK→providers NULL | 降级链下一跳 |
| capabilities | jsonb NOT NULL DEFAULT '{}' | 能力位声明 |
| pricing | jsonb NOT NULL DEFAULT '{}' | {inputPerMtok, outputPerMtok} 计价 |
| is_enabled | boolean NOT NULL DEFAULT true | |
| created_at / updated_at | timestamptz | |

### 3.12 audit_log — 审计日志（append-only）

| 列 | 类型 | 说明 |
|----|------|------|
| id | bigserial PK | |
| actor | audit_actor NOT NULL | |
| action | text NOT NULL | 如 `tool.execute` / `config.rollback` / `auth.token.enabled` |
| resource_type / resource_id | text / text NULL | |
| session_id | uuid NULL | 不设 FK，防级联 |
| detail | jsonb NOT NULL DEFAULT '{}' | 脱敏后的上下文 |
| created_at | timestamptz NOT NULL | |

**append-only 保证**：

```sql
REVOKE UPDATE, DELETE ON audit_log FROM openwork_app;
```

---

## 4. ER 总览

```
users ──< projects ──< sessions ──< messages (self tree via parent_message_id)
                        │              │
                        ├──< loop_steps ──< tool_calls
                        │         └──────< model_calls >── providers (fallback self-ref)
                        ├──< todo_items
                        ├──── uses provider (sessions.provider_id)
                        └──< configs (scope=session) ; projects/settings ; configs(global)
config_history ◄── 追踪 configs 变更
audit_log（独立,弱关联 session_id）
```

---

## 5. v0.2+ 预留（只登记，不建表）

| 未来表 | 所属能力 | 备注 |
|--------|----------|------|
| memories | 记忆系统 | 三级记忆；向量列用 pgvector |
| code_chunks + embedding 列 | RAG 索引 | pgvector HNSW 索引 |
| mcp_servers | MCP | 工具注册来源扩展 |
| hooks / skills / sub_agents | 扩展生态 | v0.3 定义语义后建模 |
| goals | GOAL | 含 AC 清单与进度度量 |
| scheduled_tasks / scheduled_task_runs | SCHED | cron/interval/event/once |
| prompt_templates | PROMPT | 版本化模板库 |

---

## 6. 数据生命周期与运维

| 事项 | 策略 |
|------|------|
| 备份 | docker volume + 用户自行 pg_dump；应用内提供会话导出(JSON/Markdown) |
| 清理 | v0.1 不自动清理；提供按会话删除（级联 messages/tool_calls/model_calls/loop_steps/todo_items） |
| 截断策略 | tool_calls.output 与 PTY 观察文本超过阈值(64KB)存截断标记，全文仅在 WS 流中实时可见 |
| 统计一致性 | sessions 冗余统计列由事务内触发器或应用层同步更新（选应用层，逻辑集中在 CostTracker） |
