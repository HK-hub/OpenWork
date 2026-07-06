-- ============================================================
-- V0_1__base.sql — OpenCoding Agent v0.1 必需 12 表
-- 对应 06-详细设计文档 v4.2 §2.1 / §2.6.1 Phase A
--
-- 包含表:
--   1. projects          - 项目
--   2. sessions          - 会话
--   3. messages          - 消息
--   4. loop_steps        - PAOR 步骤记录
--   5. tool_calls        - 工具调用记录
--   6. checkpoints      - 会话检查点
--   7. memories         - 记忆基础表 (v0.1 简化)
--   8. configs          - 配置
--   9. profiles         - 模型 Profile
--  10. audit_log        - 审计日志 (append-only)
--  11. events           - 事件日志 / ring buffer
--  12. schema_version   - 迁移版本记录
--
-- 注: permission_decisions 在 v0.1 用 PermissionGateway 内存缓存,不持久化
--     mcp_servers 在 v0.1 复用 configs 表 (key=mcp.servers)
--     memory_vectors / code_chunks_vectors 为 v0.2+ 虚拟表
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;  -- 64MB

-- ============================================================
-- 1. projects - 项目
-- ============================================================
CREATE TABLE IF NOT EXISTS projects (
    id              TEXT PRIMARY KEY,
    path            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    root_git_hash  TEXT,
    git_branch      TEXT,
    language        TEXT,
    framework       TEXT,
    package_manager TEXT,
    icon            TEXT,
    color           TEXT,
    settings        TEXT,
    last_opened_at  INTEGER NOT NULL,
    pinned          INTEGER NOT NULL DEFAULT 0,
    archived        INTEGER NOT NULL DEFAULT 0,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_pinned      ON projects(pinned, last_opened_at DESC);

-- ============================================================
-- 2. sessions - 会话
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    id                   TEXT PRIMARY KEY,
    project_id           TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id           TEXT,
    parent_session_id    TEXT,
    parent_step_id       TEXT,
    title                TEXT,
    description          TEXT,
    status               TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'paused', 'archived', 'forked', 'abandoned')),
    mode                 TEXT NOT NULL DEFAULT 'build'
        CHECK(mode IN ('ask', 'plan', 'build', 'review')),
    model_snapshot       TEXT,
    profile_snapshot     TEXT,
    token_total_in       INTEGER NOT NULL DEFAULT 0,
    token_total_out      INTEGER NOT NULL DEFAULT 0,
    token_total_cache    INTEGER NOT NULL DEFAULT 0,
    cost_total_usd       REAL NOT NULL DEFAULT 0.0,
    duration_total_ms    INTEGER NOT NULL DEFAULT 0,
    message_count        INTEGER NOT NULL DEFAULT 0,
    step_count           INTEGER NOT NULL DEFAULT 0,
    tool_call_count      INTEGER NOT NULL DEFAULT 0,
    sub_agent_count      INTEGER NOT NULL DEFAULT 0,
    tags                 TEXT,
    is_favorite          INTEGER NOT NULL DEFAULT 0,
    is_pinned            INTEGER NOT NULL DEFAULT 0,
    termination_reason   TEXT,
    termination_detail   TEXT,
    last_active_at       INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_project    ON sessions(project_id, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_parent     ON sessions(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_favorite   ON sessions(is_favorite, last_active_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_active    ON sessions(last_active_at DESC) WHERE status = 'active';

-- ============================================================
-- 3. messages - 消息
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id                   TEXT PRIMARY KEY,
    session_id           TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq                  INTEGER NOT NULL,
    role                 TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool', 'system', 'sub_agent')),
    sub_agent_id         TEXT,
    content              TEXT NOT NULL,
    original_content     TEXT,
    edited_at            INTEGER,
    edited_by            TEXT,
    is_stale             INTEGER NOT NULL DEFAULT 0,
    is_pinned            INTEGER NOT NULL DEFAULT 0,
    prompt_snapshot_hash TEXT,
    prompt_snapshot_path TEXT,
    token_in             INTEGER,
    token_out            INTEGER,
    token_cache          INTEGER DEFAULT 0,
    cost_usd             REAL,
    model_name           TEXT,
    model_provider       TEXT,
    finish_reason        TEXT,
    error_code           TEXT,
    error_message        TEXT,
    metadata             TEXT,
    created_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    UNIQUE(session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_messages_session    ON messages(session_id, seq);
CREATE INDEX IF NOT EXISTS idx_messages_role       ON messages(session_id, role);
CREATE INDEX IF NOT EXISTS idx_messages_created    ON messages(created_at);

-- ============================================================
-- 4. loop_steps - Loop 步骤 (PAOR trace)
-- ============================================================
CREATE TABLE IF NOT EXISTS loop_steps (
    id                   TEXT PRIMARY KEY,
    session_id           TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    step                 INTEGER NOT NULL,
    iteration            INTEGER NOT NULL,
    phase                TEXT NOT NULL CHECK(phase IN ('perceive', 'act', 'observe', 'reflect', 'plan', 'verify', 'recover')),
    sub_phase            TEXT,
    parent_loop_step_id  TEXT REFERENCES loop_steps(id) ON DELETE SET NULL,
    sub_agent_id         TEXT,
    sub_agent_instance   TEXT,
    payload              TEXT NOT NULL,
    payload_summary      TEXT,
    token_in             INTEGER,
    token_out            INTEGER,
    cost_usd             REAL,
    duration_ms          INTEGER,
    is_checkpoint        INTEGER NOT NULL DEFAULT 0,
    is_sub_agent_root    INTEGER NOT NULL DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'success'
        CHECK(status IN ('success', 'error', 'skipped', 'cancelled', 'pending')),
    error_code           TEXT,
    error_message        TEXT,
    created_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_loop_steps_session   ON loop_steps(session_id, step);
CREATE INDEX IF NOT EXISTS idx_loop_steps_parent    ON loop_steps(parent_loop_step_id);
CREATE INDEX IF NOT EXISTS idx_loop_steps_phase     ON loop_steps(session_id, phase);
CREATE INDEX IF NOT EXISTS idx_loop_steps_sub_agent ON loop_steps(sub_agent_instance);

-- ============================================================
-- 5. tool_calls - 工具调用
-- ============================================================
CREATE TABLE IF NOT EXISTS tool_calls (
    id                   TEXT PRIMARY KEY,
    message_id           TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    session_id           TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    loop_step_id         TEXT REFERENCES loop_steps(id) ON DELETE SET NULL,
    sub_agent_instance   TEXT,
    step_number          INTEGER NOT NULL,
    call_index           INTEGER NOT NULL DEFAULT 0,
    tool_name            TEXT NOT NULL,
    tool_source          TEXT NOT NULL CHECK(tool_source IN ('builtin', 'mcp', 'plugin', 'skill', 'custom', 'sub_agent')),
    tool_source_id       TEXT,
    tool_version         TEXT,
    args                 TEXT NOT NULL,
    args_schema_hash     TEXT,
    result               TEXT,
    result_summary       TEXT,
    original_result      TEXT,
    modified_result      TEXT,
    modified_by          TEXT,
    modified_at          INTEGER,
    risk_level           TEXT NOT NULL CHECK(risk_level IN ('L0', 'L1', 'L2', 'L3')),
    requires_approval    INTEGER NOT NULL DEFAULT 0,
    approval_id          TEXT,
    approved_by          TEXT,
    approval_timestamp   INTEGER,
    duration_ms          INTEGER,
    tokens_included      INTEGER DEFAULT 0,
    status               TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'awaiting_approval', 'denied', 'running',
                         'success', 'error', 'timeout', 'user_modified', 'cancelled')),
    error_code           TEXT,
    error_message        TEXT,
    retry_count          INTEGER NOT NULL DEFAULT 0,
    retry_parent_id      TEXT REFERENCES tool_calls(id) ON DELETE SET NULL,
    created_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    completed_at         INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session   ON tool_calls(session_id, step_number);
CREATE INDEX IF NOT EXISTS idx_tool_calls_message   ON tool_calls(message_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_status    ON tool_calls(status);
CREATE INDEX IF NOT EXISTS idx_tool_calls_source     ON tool_calls(tool_source, tool_source_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_loop       ON tool_calls(loop_step_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_sub_agent  ON tool_calls(sub_agent_instance);

-- ============================================================
-- 6. checkpoints - Loop 检查点
-- ============================================================
CREATE TABLE IF NOT EXISTS checkpoints (
    id                   TEXT PRIMARY KEY,
    session_id           TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    step                 INTEGER NOT NULL,
    iteration            INTEGER NOT NULL,
    phase                TEXT NOT NULL,
    sub_agent_instance   TEXT,
    snapshot             TEXT NOT NULL,
    snapshot_path        TEXT,
    message_seq          INTEGER,
    token_usage          INTEGER,
    cost_usd             REAL,
    is_auto              INTEGER NOT NULL DEFAULT 1,
    is_restored          INTEGER NOT NULL DEFAULT 0,
    label                TEXT,
    description          TEXT,
    created_at           INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session  ON checkpoints(session_id, step);
CREATE INDEX IF NOT EXISTS idx_checkpoints_sub       ON checkpoints(sub_agent_instance, step);

-- ============================================================
-- 7. memories - 记忆 (v0.1 简化版,无向量索引)
-- ============================================================
CREATE TABLE IF NOT EXISTS memories (
    id                TEXT PRIMARY KEY,
    session_id        TEXT REFERENCES sessions(id) ON DELETE CASCADE,
    category          TEXT NOT NULL CHECK(category IN ('preference', 'fact', 'skill', 'episode', 'procedure', 'context')),
    content           TEXT NOT NULL,
    metadata          TEXT,
    importance        REAL NOT NULL DEFAULT 0.5 CHECK(importance >= 0 AND importance <= 1),
    embedding         TEXT,  -- v0.2+: 迁移到 memory_vectors 虚拟表
    last_accessed_at  INTEGER,
    access_count      INTEGER NOT NULL DEFAULT 0,
    created_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at        INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_memories_session   ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_category  ON memories(category);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);

-- ============================================================
-- 8. configs - 配置 (key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS configs (
    key         TEXT NOT NULL,
    scope       TEXT NOT NULL CHECK(scope IN ('global', 'project', 'session'))
        DEFAULT 'global',
    profile_id  TEXT,
    value       TEXT NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (key, scope, COALESCE(profile_id, ''))
);

CREATE INDEX IF NOT EXISTS idx_configs_scope  ON configs(scope);
CREATE INDEX IF NOT EXISTS idx_configs_profile ON configs(profile_id);

-- ============================================================
-- 9. profiles - 模型配置档案
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL UNIQUE,
    description   TEXT,
    base          TEXT,
    provider      TEXT NOT NULL CHECK(provider IN ('anthropic', 'openai', 'ollama', 'openai-compat', 'custom')),
    model         TEXT NOT NULL,
    params        TEXT,        -- JSON: ModelParams
    router        TEXT,        -- JSON: RouterConfig
    is_default    INTEGER NOT NULL DEFAULT 0,
    created_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_profiles_default ON profiles(is_default) WHERE is_default = 1;

-- ============================================================
-- 10. audit_log - 审计日志 (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id            TEXT PRIMARY KEY,
    timestamp     INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    actor         TEXT NOT NULL,
    action        TEXT NOT NULL CHECK(action IN ('create', 'read', 'update', 'delete', 'execute', 'approve', 'deny', 'export', 'login', 'logout', 'config_change')),
    resource      TEXT NOT NULL,
    resource_id   TEXT,
    session_id    TEXT,
    detail        TEXT,
    ip_address    TEXT,
    user_agent    TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_action    ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource  ON audit_log(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_session   ON audit_log(session_id);

-- ============================================================
-- 11. events - 事件日志 / ring buffer 持久化
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
    id            TEXT PRIMARY KEY,
    type          TEXT NOT NULL,
    session_id    TEXT,
    run_id        TEXT,
    payload       TEXT NOT NULL,        -- JSON: AppEvent
    timestamp     INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_events_type      ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_session   ON events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_run       ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp DESC);

-- ============================================================
-- 12. schema_version - 迁移版本记录
-- ============================================================
CREATE TABLE IF NOT EXISTS schema_version (
    version       TEXT PRIMARY KEY,           -- 如 '0.1.0'
    applied_at    INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    checksum      TEXT,                       -- SQL 文件 SHA256
    description   TEXT
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES ('0.1.0', 'v0.1 base: 12 tables (projects/sessions/messages/loop_steps/tool_calls/checkpoints/memories/configs/profiles/audit_log/events/schema_version)');

-- 默认 profile (anthropic claude-3-5-sonnet)
INSERT OR IGNORE INTO profiles (id, name, description, provider, model, params, is_default)
VALUES (
    'prof_default',
    'default',
    'Default profile: Anthropic Claude 3.5 Sonnet',
    'anthropic',
    'claude-3-5-sonnet-20241022',
    '{"temperature":0,"maxTokens":8192}',
    1
);

-- 默认配置项
INSERT OR IGNORE INTO configs (key, scope, value) VALUES ('agent.maxIterations', 'global', '25');
INSERT OR IGNORE INTO configs (key, scope, value) VALUES ('agent.budgetUsd', 'global', '5.0');
INSERT OR IGNORE INTO configs (key, scope, value) VALUES ('agent.autoApproveLowRisk', 'global', 'true');
INSERT OR IGNORE INTO configs (key, scope, value) VALUES ('ui.theme', 'global', '"auto"');
INSERT OR IGNORE INTO configs (key, scope, value) VALUES ('logging.level', 'global', '"info"');

-- @down
-- 回滚: v0.1 base 不支持 down (基线)
SELECT 1;
