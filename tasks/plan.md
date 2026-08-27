# Implementation Plan: OpenWork v2 v0.1

## Overview

按 `docs/design/v2/` 将空仓库实现为可运行的本机优先 Coding Agent Web 应用：Vite React SPA、NestJS API/WS、PostgreSQL/Drizzle 持久化、共享 contracts，以及受路径白名单和权限分级保护的 Agent 工具循环。

## Architecture Decisions

- 使用 npm workspaces + Turborepo，工作区为 `apps/server`、`apps/web`、`packages/contracts`。
- contracts 是前后端唯一事实源，所有边界 payload 使用 Zod 校验。
- 服务端按 Presentation → Application → Domain ← Infrastructure 分层；本阶段先提供可运行的内存适配器，PostgreSQL/Drizzle schema 与生产适配器同步落地。
- 默认绑定 `127.0.0.1`，文件工具只能访问已注册项目根目录，L2/L3 工具需要审批。

## Task List

### Phase 1: Foundation
- [x] 建立根工程、TypeScript strict 配置、Turborepo、Docker Compose。
- [x] 实现 contracts：枚举、错误码、REST DTO、WS 事件、工具 schema。
- [x] 建立 12 张 PostgreSQL 表的 Drizzle schema 与迁移入口。

### Checkpoint: Foundation
- [x] contracts 单元测试通过。
- [x] 全仓类型检查与构建通过。

### Phase 2: Core Features
- [x] 项目注册、路径白名单、会话 CRUD 和消息树 API。
- [x] Provider 注册、配置版本化基础、统计 API。
- [x] Agent 主循环、真实文件/搜索/命令工具、工具审计和 L2 审批状态。
- [x] Socket.io `/ws` 流式事件与中止。

### Checkpoint: Core Features
- [x] 注册项目 → 创建会话 → 发送消息 → 获得流式响应的闭环可运行。
- [ ] 完整 Provider SDK、PTY 人工接管、工具审批持久化和事件补发属于下一实施增量。

### Phase 3: Web
- [x] React 工作台：项目/会话侧栏、消息流、工具调用卡片和审批按钮。
- [x] 发送/停止交互接入 REST + WS。

### Checkpoint: Complete
- [x] 测试、类型检查、构建全部通过。
- [x] 文档与运行说明齐全。

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| 本机未安装 PostgreSQL/Docker | Medium | 提供内存适配器和明确启动检查，生产适配器仍使用 Drizzle。 |
| node-pty 原生依赖安装失败 | High | 保留 child_process 降级 runner，并在启动检查中提示。 |
| LLM 凭证/网络不可用 | High | Provider 接口可注入 fake，默认返回可测试的本地演示模型。 |
| 大范围 v0.1 需求 | High | 先保证最小纵向闭环，再逐步补齐 P0 端点和 UI。 |

## Open Questions

- 真实部署时由用户提供 PostgreSQL 与 Provider 凭证；本地开发可使用 `.env.example` 和演示 Provider。
