# OpenWork v2

本机优先的 Coding Agent Web 应用，按 `docs/design/v2/` 基线实现。

## 开发启动

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

- Web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000/api/v1`
- WebSocket namespace: `/ws`

当前默认使用内存 Repository，便于零配置运行。PostgreSQL 17 与完整 Drizzle 12 表 schema 已在 `docker-compose.yml` 和 `apps/server/src/infrastructure/drizzle/schema.ts` 定义；后续生产装配可切换为 Drizzle Repository。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

PowerShell 环境若禁止执行 `npm.ps1`，请使用 `npm.cmd`。
