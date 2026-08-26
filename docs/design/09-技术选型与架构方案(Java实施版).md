# OpenWork — 技术选型与架构方案 (Java 实施版)

> **文档版本**: v1.0
> **文档类型**: Technology Selection & Architecture Document (Java 实施基线)
> **审视视角**: 架构师 / 技术总监 (CTO) / 高级研发
> **编写日期**: 2026-08-26
> **开源协议**: MIT（与 01/02 文档一致）
>
> **关联文档**:
> - [01-产品功能文档.md](./01-产品功能文档.md) (v2.4) — 产品功能全景
> - [04-架构设计文档.md](./04-架构设计文档.md) (v4.3) — 原 TS 分层架构基线（本文档继承其 9 层架构与模块划分）
> - [05-技术选型文档.md](./05-技术选型文档.md) (v4.3) — 原 TS 技术选型（前端域锁定值继续有效，后端域由本文档取代）
> - [06-详细设计文档.md](./06-详细设计文档.md) (v4.3) — 20 张表定义与模块详细设计
>
> **v1.0 变更说明 (Java 化重写)**:
> - **产品命名统一**: 项目正式名称为 **OpenWork**。Maven `groupId=com.openwork`，模块前缀 `openwork-*`，配置前缀 `openwork.*`，包名 `com.openwork.*`，数据目录 `~/.openwork/`。（历史文档标题中的 "OpenCoding" 为旧代号，以 OpenWork 为准；历史 `@opencode/*` npm 包名对应关系见 §8 映射表。）
> - **客户端形态变更**: 放弃 Electron 桌面壳，v0.1 采用 **"本地 Java 服务 + 浏览器 Web Client" 前后端分离形态**，打包分发（jpackage/Docker/桌面壳）延后至后续版本。
> - **数据库变更**: 主数据库弃 SQLite，改用 **PostgreSQL + pgvector**；混合检索采用 **pgvector / Milvus / Elasticsearch** 多路方案。
> - **持久化契约不变**: 沿用 04 文档 §11.9 的 DDD Repository 接口隔离原则，并升级为**多层 Port 隔离**（关系型 / 向量 / 关键词三层数据源差异全部屏蔽在 domain 层接口之后）。
> - **表基线勘误**: 原文档群中"20 张表"的表述与 06 文档 §2.1 实际 DDL（**29 张**，含 projects/events/schema_version/secrets 等）不一致，且"v0.1 12 表"子集清单在 01 与 06 间互相冲突。本文档以 **06 §2.1 DDL 全集为唯一权威基线**（Flyway V1 据此出 PG 化脚本），v0.1 启用子集的取舍登记为 §11 O11。
>
> **版本号约定**: 本文所列版本为**版本线（major.minor.x）**，实施时以发布日最新稳定版为准，并通过 BOM 统一锁定精确版本。

---

## 目录

- [0. 决策摘要与选型原则](#0-决策摘要与选型原则)
- [1. 总体架构与部署拓扑](#1-总体架构与部署拓扑)
- [2. 工程结构 (Maven 多模块)](#2-工程结构-maven-多模块)
- [3. 后端技术选型逐域明细](#3-后端技术选型逐域明细)
- [4. 前端技术栈 (沿用原锁定值)](#4-前端技术栈-沿用原锁定值)
- [5. Repository 多层隔离设计 (DDD)](#5-repository-多层隔离设计-ddd)
- [6. 测试与质量工程](#6-测试与质量工程)
- [7. 构建、打包与供应链安全](#7-构建打包与供应链安全)
- [8. 与原 TS 方案逐项映射总表](#8-与原-ts-方案逐项映射总表)
- [9. 依赖版本锁定总表](#9-依赖版本锁定总表)
- [10. 许可证合规矩阵](#10-许可证合规矩阵)
- [11. 风险清单与开放问题](#11-风险清单与开放问题)
- [附录 A: 选型决策记录 (ADR)](#附录-a-选型决策记录-adr)

---

## 0. 决策摘要与选型原则

### 0.1 核心决策摘要

| # | 决策点 | 结论 | 备注 |
|---|--------|------|------|
| D1 | 产品形态 | 本地 Java 服务 + 浏览器 Web Client | 弃 Electron/桌面壳，打包延后 |
| D2 | 后端语言运行时 | Java 21 LTS（虚拟线程） | Agent Loop 并发的结构性优势 |
| D3 | 应用框架基座 | Spring Boot 3.5.x | 虚拟线程支持、生态、LLM/MCP 集成 |
| D4 | LLM 统一接入 | LangChain4j 1.x | 40+ Provider、流式+工具调用+MCP 模块 |
| D5 | MCP | MCP 官方 Java SDK (`io.modelcontextprotocol.sdk:mcp`) | 与 JSON-RPC 协议同构 |
| D6 | 主数据库 | PostgreSQL 17 + pgvector 扩展 | 弃 SQLite；单实例起步 |
| D7 | 数据访问层 | MyBatis-Plus (spring-boot3 starter) + Flyway | 团队偏好；SQL 可控；Schema 版控迁移 |
| D8 | 检索引擎 | VectorIndexPort(pgvector \| Milvus) + KeywordIndexPort(Elasticsearch+IK \| PG FTS) + RRF 融合 | 多层 Repository 接口隔离数据源差异 |
| D9 | 任务调度 | Spring @Scheduled + DB 驱动动态调度器 | 单实例限制声明；多实例时升级 Quartz（接口不变） |
| D10 | 构建工具 | Maven 多模块 | 前端经 frontend-maven-plugin 编排进 Maven 生命周期 |
| D11 | 通信协议 | JSON-RPC 2.0 自实现（Jackson 绑定） | 与原方案一致：零依赖、与 MCP 同构 |
| D12 | 前端栈 | React 19 + antd v5 + Tailwind v4 + Monaco + xterm.js 等 | 完整沿用 05 文档锁定值 |

### 0.2 选型原则（按优先级降序）

1. **避免重复造轮子**：优先选择生产验证的开源框架/中间件，自研仅限协议薄层（JSON-RPC Dispatcher）、领域 Port 适配器等必要部分；
2. **生态成熟度与社区活跃度**：长期维护、中文资料充足、招聘容易；
3. **DDD 分层隔离**：业务层只依赖 domain 层接口（Repository/Port），所有数据源差异（PG/Milvus/ES）被适配器屏蔽，可整体替换；
4. **服务化可演进**：v0.1 单机 localhost 起步，但所有组件（PG/Milvus/ES/@Scheduled→Quartz）均预留水平扩展路径；
5. **开源合规**：全部依赖许可证与 MIT 主协议兼容，CI 强制 SBOM + CVE 扫描；
6. **性能体验平衡**：虚拟线程承担并发，UI 流畅性由前端独立保障。

---

## 1. 总体架构与部署拓扑

### 1.1 形态说明

v0.1 采用**前后端分离的服务模式**：

```
┌─────────────────────────────────────────────────────┐
│  Web Client (浏览器)                                 │
│  React 19 + antd v5 + Tailwind v4                   │
│  Monaco Editor + xterm.js + TipTap                  │
│  Zustand + Zod + OpenWorkClient SDK                 │
└──────────────┬──────────────────────────────────────┘
               │ JSON-RPC 2.0 over HTTP+SSE / WebSocket
               │ (127.0.0.1, 随机端口 + 启动 Token 握手)
┌──────────────▼──────────────────────────────────────┐
│  openwork-server (Spring Boot 3.5.x fat-jar)        │
│                                                     │
│  L4 Transport: HTTP+SSE(SseEmitter) · WebSocket     │
│                (stdio / Embedded 接口占位不实现)      │
│  L5 App: JSON-RPC Dispatcher · 会话管理              │
│          · 权限仲裁(L0-L3) · 配置热加载               │
├─────────────────────────────────────────────────────┤
│  L6 openwork-core   : PAOR Loop (虚拟线程/会话)       │
│  L7 openwork-tools  : 内置工具集 (read/edit/bash...) │
│  L7 openwork-mcp    : MCP Client (官方 Java SDK)     │
│  L8 (core 内)       : LangChain4j Provider 抽象      │
│  L9 openwork-storage: MyBatis-Plus/Flyway/Port 实现  │
└──┬──────────────┬──────────────┬────────────────────┘
   │ JDBC         │ RestClient   │ gRPC SDK
   ▼              ▼              ▼
PostgreSQL 17   Elasticsearch   Milvus 2.x
(+pgvector)     8.x (+IK 插件)  standalone (可选启用)
```

### 1.2 原 9 层架构映射

04 文档的 9 层 CS 分离架构完整保留，仅替换实现技术：

| 层 | 原 TS 方案 | Java 方案 | 变化性质 |
|----|-----------|----------|----------|
| L1 表现层 | React 19 + antd v5 + Monaco + xterm.js | **不变**（浏览器访问） | 无变化 |
| L2 客户端应用层 | Zustand + Zod + Client SDK | **不变** | 无变化 |
| L3 API 契约层 | `@opencode/api` TS 包 | `openwork-api` Maven 模块（Jackson POJO）；经 victools 生成 JSON Schema → 前端 Zod/TS 类型 | 替换实现，契约语义不变 |
| L4 Transport | Fastify/ws/stdio/Electron IPC/Direct | Spring MVC + SseEmitter / spring-websocket；stdio 占位；~~Electron IPC~~ 移除 | 替换实现 |
| L5 后端应用层 | App Controller + 自研 JSON-RPC Dispatcher | 同构：Spring 生命周期托管 + 自研 Dispatcher（Jackson 绑定） | 替换实现 |
| L6 Agent 核心层 | Worker Threads 内 PAOR 循环 | **每会话一个虚拟线程**跑 PAOR Loop；工具调用走虚拟线程池 | 结构性替换（详见 §3.9） |
| L7 能力扩展层 | Worker Pool + isolated-vm | 虚拟线程工具池 + **子进程沙箱**（插件/Hooks 独立 JVM 进程 + 权限清单 + 超时/OOM 重启） | 隔离模型更换 |
| L8 模型抽象层 | openai/@anthropic SDK | LangChain4j ChatModel/StreamingChatModel + 自研 Provider Registry/Fallback | 替换实现 |
| L9 基础设施层 | better-sqlite3/sqlite-vec/FTS5/chokidar/node-crypto | PostgreSQL(JDBC) + pgvector/Milvus/ES + directory-watcher + JCA 加密 | 替换实现 |

### 1.3 运行模式演进路线

| 版本 | 模式 | 说明 |
|------|------|------|
| v0.1 | Service (单机) | localhost 服务 + 浏览器 Web Client；docker-compose 一键拉起中间件 |
| v0.2 | Service (远程) | 服务部署到内网服务器，Web/TUI/CLI 多客户端共连；@Scheduled → Quartz 升级评估 |
| 后续 | 桌面壳打包 | jpackage 打包单机发行版，或 JavaFX/JCEF 壳加载同一 Web UI（Transport 接口已预留 Embedded 模式） |

---

## 2. 工程结构 (Maven 多模块)

```
openwork/
├── backend/                          # Java 后端 (Maven 多模块, parent POM 聚合)
│   ├── openwork-api                  # L3: JSON-RPC 方法契约 + DTO + 事件类型 (唯一类型真源,
│   │                                 #     纯 POJO + Jackson 注解, 不依赖任何中间件)
│   ├── openwork-core                 # L6-L8: PAOR Loop / Prompt Engine / Context Engine /
│   │                                 #     Harness 子循环 / SubAgent 编排 / LangChain4j 集成
│   ├── openwork-tools                # L7: 内置工具集 (read/write/edit/bash/git/glob/grep/
│   │                                 #     web_fetch/web_search/memory/todo...)
│   ├── openwork-mcp                  # L7: MCP Client 封装 (stdio/SSE/HTTP transport)
│   ├── openwork-storage              # L9: Repository/Port 接口实现
│   │                                 #     (MyBatis-Plus Mapper + Flyway 迁移 + ES/Milvus/pgvector 适配器)
│   ├── openwork-server               # L4-L5: Transport Hosts (SSE/WebSocket/stdio 占位) +
│   │                                 #     JSON-RPC Dispatcher + 会话/权限编排
│   └── openwork-app                  # 可执行入口 (spring-boot fat-jar; 未来 jpackage 打包源)
├── frontend/                         # Web Client (npm/Vite, 沿用 05 文档工程约定)
│   └── src/api-client/               # 由 openwork-api 的 JSON Schema 生成的 Zod schema + TS 类型
├── docker-compose.dev.yml            # 开发环境中间件 (postgres+pgvector / elasticsearch / milvus profile)
└── pom.xml                           # 根聚合 POM (dependencyManagement + BOM imports)
```

**命名规范**：
- `groupId`: `com.openwork`
- artifactId 前缀: `openwork-*`（仓库/worktree 名称不影响命名）
- Java 包名: `com.openwork.<module>`（如 `com.openwork.core.loop`）
- 配置前缀: `openwork.*`（见 §5.3 示例）

**依赖方向规则**（与 04 文档 §3.2 对齐，ArchUnit 强制守护，见 §6.2）：

```
openwork-api ← openwork-core ← openwork-tools / openwork-mcp ← openwork-server ← openwork-app
                     ▲ 单向依赖: storage 实现并依赖 core 的接口
              openwork-storage (MyBatis-Plus/Flyway/ES/Milvus/pgvector 适配器)
规则:
1. openwork-api 是唯一类型真源, 不依赖任何第三方中间件
2. domain 接口 (Repository/Port) 归 openwork-core 所有 (com.openwork.core.domain..);
   openwork-storage 编译期单向依赖 core 并实现这些接口 (装配注入由 openwork-app 完成);
   core/tools/mcp 禁止 import storage.* 实现类与任何中间件客户端类 (JDBC/ES/Milvus SDK)
3. 下层不能调用上层; 跨层调用必须经过接口契约
```

---

## 3. 后端技术选型逐域明细

### 3.1 语言与运行时

| 维度 | 结论 |
|------|------|
| 选型 | **Java 21 LTS**（Temurin 发行版），开启虚拟线程 |
| 并发模型 | 虚拟线程：每会话一个虚拟线程执行 PAOR Loop；工具执行/索引走 `Executors.newVirtualThreadPerTaskExecutor()` 派生池 |
| 备选对比 | Java 17（无虚拟线程，❌）/ Java 25 LTS（更新但生态兼容验证期，🟡 观察升级） |
| 锁定 | `java.version=21`；`spring.threads.virtual.enabled=true` |

**理由**：
1. Node.js Worker Threads 解决的"CPU 密集任务阻塞事件循环"问题在 JVM 不存在；虚拟线程提供百万级阻塞式并发且编写心智为同步代码，PAOR 循环/流式读取/工具调用可直接写成直观的阻塞风格；
2. LTS 版本保证 Spring Boot 3.x / 各中间件客户端库的一线支持；
3. 结构化并发（StructuredTaskScope）目前仍处 preview，Sub-Agent DAG 编排先用虚拟线程池 + CompletableFuture，待 JDK 正式转正后切换。

**风险与缓解**：

| 风险 | 缓解 |
|------|------|
| synchronized 块中 pinning 载体线程（JDK 21 已大幅缓解，24 起 JEP 491 基本消除） | 代码规约禁止在热路径长持锁；升级 JDK 时回归压测 |
| 虚拟线程滥用导致资源失控（无界并发打爆下游 PG 连接池） | 信号量/有界作用域限流每个会话的并发工具数；HikariCP 池上限兜底 |

### 3.2 应用框架基座

| 维度 | 结论 |
|------|------|
| 选型 | **Spring Boot 3.5.x**（spring-boot-starter-web + websocket + actuator + validation） |
| 备选对比 | Quarkus（启动快/内存低，但生态小、LLM 集成需手动接线 ❌）/ Micronaut（同位风险 ❌）/ 纯 JDK（违背造轮子禁令 ❌） |
| 锁定 | Spring Boot BOM 管理；虚拟线程开启；AOT/native-image 非 v0.1 目标 |

**理由**：生态最大、中文资料最多；LangChain4j/MCP/Testcontainers 均有一线集成；嵌入式 Tomcat + 虚拟线程即可满足本地服务的 SSE/WebSocket 流式需求，无需响应式编程栈（WebFlux 不采用——增加复杂度且本地单机场景收益为零）。

### 3.3 通信协议与 Transport

| 维度 | 结论 |
|------|------|
| 协议 | **JSON-RPC 2.0 自实现**（~200 行：Request/Response/Notification/Error + Jackson 绑定），与 MCP 协议同构 |
| HTTP+SSE | Spring MVC + `SseEmitter`（请求/响应 + 事件流推送），虚拟线程下阻塞式写简单可靠 |
| WebSocket | `spring-boot-starter-websocket`，供双向实时场景（终端桥接、多 Agent 监控） |
| stdio | 接口占位（newline-delimited JSON over stdin/stdout），为未来 CLI/TUI 客户端预留，v0.1 不实现 |
| 安全 | 服务绑定 `127.0.0.1`；启动生成随机 Bearer Token（控制台输出，前端首次配置）；CORS 白名单仅 localhost dev origins |

**理由**：与原设计完全同构（零依赖哲学保留）；Fastify→Spring MVC 的替换不改变 JSON-RPC 语义层，06 文档的 Transport 详细设计可直接移植。

### 3.4 数据访问与迁移

| 维度 | 结论 |
|------|------|
| ORM | **MyBatis-Plus 3.5.x**（`mybatis-plus-spring-boot3-starter`）：BaseMapper 即得 CRUD，复杂 SQL 手写 XML/注解，SQLite 方言顾虑不存在（PG 方言成熟） |
| 连接池 | **HikariCP**（Boot 默认） |
| Schema 迁移 | **Flyway 10.x+**（SQL 脚本置于 classpath `db/migration`；基线 V1__init.sql 以 06 文档 §2.1 DDL 全集（29 表）的 PG 化转译为准，v0.1 启用子集取舍见 §11 O11） |
| 备选对比 | JDBI 3（轻量 ✅ 备胎）/ Spring Data JDBC（SQLite 方言顾虑已消，但聚合映射受限 🟡）/ jOOQ（类型安全但 AGPL 商用风险 ❌） |
| 事务 | Spring `@Transactional`；**短事务纪律**：事务边界收敛于 Repository 方法级，禁止在事务内进行 LLM 流式调用、子进程执行等长阻塞操作（虚拟线程×JDBC 连接池约束详见 §3.9）；审计写入走 REQUIRES_NEW 独立提交边界 |
| append-only 保障 | `audit_log` 使用专用 DB 写角色并 `REVOKE UPDATE, DELETE`，辅以 BEFORE UPDATE/DELETE 触发器 RAISE EXCEPTION（事务传播只保证原子性，不构成防篡改，必须在 DB 层收权） |
| 配置热加载 | **PG LISTEN/NOTIFY**：专用连接监听 `config_changed` 通知 → 发布 Spring 应用事件 → 各组件缓存失效刷新；监听异常时降级为 fixedDelay 轮询兜底 |

**理由**：20 张表的 Schema 在 06 文档已手写设计完成，MyBatis-Plus 让团队以最小学习成本获得 CRUD 自动化 + 全量 SQL 控制权；DDL 演进交给 Flyway 版本化，二者职责清晰不重叠。

### 3.5 主数据库

| 维度 | 结论 |
|------|------|
| 选型 | **PostgreSQL 17** + **pgvector 0.8+** 扩展（HNSW 索引） |
| 角色 | 系统记录真源（SoR）：20 张表全量落 PG；同时作为向量检索默认后端（pgvector） |
| 中文全文备选路 | PG 内建 tsvector + zhparser/jieba 分词插件（作为 KeywordIndexPort 的 `pg-fts` 实现备选，见 §5） |
| 备选对比 | SQLite（单文件本地优先，但用户已决策转向服务化 PG；Repository 隔离保留未来 H2/SQLite 演示档位的可能性 🟡）/ MySQL（JSON/扩展生态弱于 PG ❌） |

**理由**：一次选型同时覆盖"关系存储 + 向量检索"两个域，运维面最小；pgvector HNSW 在十万级向量规模内表现良好；未来大规模切 Milvus 时仅替换 VectorIndexPort 适配器。

**存储布局与 Blob 策略**：
- 大附件（会话附件、多模态图片、导出包）落文件系统 `~/.openwork/sessions/<sessionId>/...`，PG 仅存路径引用 + 元数据 + sha256 校验，**禁止将大对象存 bytea**；
- 检索索引由各引擎自管（pgvector 在库内、ES/Milvus 各自数据目录），不纳入 PG 备份链路；
- 目录约定沿用原文档语义：`~/.openwork/{logs/, cache/, plugins/, backups/}` + `<project>/.openwork/` 项目级文件（commands/skills/prompts 及 AGENTS.md/CLAUDE.md 兼容读取）；项目级文件保持文件形态，PG 承载全局配置真源；
- 备份：定时 `pg_dump` 逻辑备份至 `~/.openwork/backups/`（N 份轮转），恢复 runbook 随仓库交付；数据导出功能（§3.12）与其共用 zip 打包管线。

### 3.6 混合检索引擎（三层 Port 架构）

需求来源：01 文档 §4.2.3 Hybrid RAG（语义向量 + BM25 关键词 + 符号结构 + RRF 融合）。

| 路 | 默认实现 | 大规模/备选实现 | 隔离接口 |
|----|---------|----------------|----------|
| 语义向量 | **pgvector**（HNSW，嵌入维度随模型） | **Milvus 2.5+ standalone**（亿级、标量过滤强） | `VectorIndexPort` |
| 关键词 BM25 | **Elasticsearch 8.x + IK Analyzer**（中文分词） | PG tsvector + zhparser（`pg-fts`，少一个中间件档位） | `KeywordIndexPort` |
| 符号结构图 | PG jsonb（初版） | 图数据库远期评估 | `SymbolGraphPort` |

- 融合层：应用服务 `RetrievalService` 三路并行（虚拟线程）发起查询 → **RRF（Reciprocal Rank Fusion）**融合排序 → 截断注入上下文；
- 向量路默认直接采用 LangChain4j 官方 **`langchain4j-pgvector` / `langchain4j-milvus`** EmbeddingStore 模块（遵循"避免造轮子"首要原则，ADR-007）；BM25 路不经 EmbeddingStore 抽象，直连 `elasticsearch-java` 客户端；仅当官方模块能力不足时才自写适配器并记录理由；
- 切换方式：`@ConditionalOnProperty` 条件装配（见 §5.3），配置一行切换，不改业务代码。

**运维提示**：Milvus standalone 自带 etcd + minio 依赖容器，开发期较重——compose 中放入独立 profile（`--profile vector-scale`）按需启动；默认开发档位只跑 PG + ES。

### 3.7 LLM 统一接入 (LangChain4j)

| 维度 | 结论 |
|------|------|
| 选型 | **LangChain4j 1.x**（`langchain4j-bom` 统一版本管理） |
| 核心用法 | `ChatModel` / `StreamingChatModel`（流式 token/tool-call 事件）、Tool Calling（@Tool 注解或低阶 ToolSpecification）、结构化输出、`ChatMemory` 不采用（会话记忆由自研三级记忆体系承载，避免双轨） |
| Provider 矩阵 | OpenAI / Anthropic / Google Gemini / Ollama / 任意 OpenAI 兼容端点（OpenRouter/DeepSeek/vLLM 等）——对应 01 文档 §4.3.5 v0.1 范围；Azure/Bedrock v0.2+ |
| Embedding | LangChain4j EmbeddingModel（OpenAI embeddings 或本地 `langchain4j-embeddings-bge-small-*` ONNX 离线档） |
| 备选对比 | Spring AI（starter 体验好，但 Provider 覆盖窄于 LangChain4j 🟡）/ 官方 SDK + 自建适配层（对齐原哲学但重复造轮子 ❌） |

**Provider Registry / Adapter 契约落地**（对齐 01 文档 §4.3.5）：

```java
// com.openwork.core.provider —— 基于 LangChain4j 之上再包一层项目契约
public interface AiProviderAdapter {
    String id();
    Set<Capability> capabilities();   // streaming / tool_call / vision / json_mode / prompt_caching...
    StreamingChatModel chatModel(ProviderConfig cfg);
    EmbeddingModel embeddingModel(ProviderConfig cfg);   // 可选
}

@Component
public class ProviderRegistry { /* register/get/list + 热插拔 */ }

public class FallbackRouter { /* 按 capabilities + 成本/延迟选路, 失败沿 fallback 链降级, Ollama 兜底 */ }
```

- 计价表：内置主流模型 $/Mtok 单价表（沿用 06 文档 model_calls 成本归因字段）；
- Token 计数：**jtokkit 1.x**（tiktoken 的 Java 实现），非 OpenAI 家模型按 provider 专用计数器或估算并标注置信度。

### 3.8 MCP 集成

| 维度 | 结论 |
|------|------|
| 选型 | **MCP 官方 Java SDK** `io.modelcontextprotocol.sdk:mcp` |
| Transport | stdio / SSE / Streamable HTTP（SDK 内置） |
| 集成点 | MCP 工具发现后注册进 Tool Registry，与内置工具同等待遇（权限分级、审计、超时控制）；健康检查 + 指数退避自动重连 |

### 3.9 Agent 引擎并发模型（L6/L7 核心）

| 场景 | 方案 |
|------|------|
| 会话主循环 | 每个活跃会话一个虚拟线程执行 PAOR Loop（Perceive→Act→Observe→Reflect），阻塞式写法 |
| 工具执行 | 虚拟线程派生池；单工具限时：`orTimeout(...)` 后 `cancel(true)` 中断任务；**子进程类工具由 watchdog 对 `Process.descendants()` 执行 destroyForcibly 进程树清理**（interrupt 无法终止阻塞的管道 IO，必须进程级兜底）；并发工具数受信号量限制 |
| Sub-Agent (v0.3) | 虚拟线程池 + CompletableFuture DAG 编排；上下文隔离 = 独立会话状态对象；成本归因挂父任务 |
| Checkpoint | Loop 状态序列化为 JSON 落 `checkpoints` 表，暂停/恢复/时间旅行语义与原设计一致 |
| 事件推送 | 会话级 `SessionEventBroker`：内部队列 + SSE 连接注册表；所有事件同步落 `events` 表（EventLogRepository），SSE 断线重连凭 `lastEventId` 回放补发窗口内事件；慢消费者背压策略 = 丢弃中间 delta 保关键事件（tool_call/error），并记驱逐日志（对齐 04 文档 §12 背压要求） |
| 连接池纪律 | HikariCP 基线：maxPool ≈ 活跃会话数 × 每会话 DB 并发上限（默认 2）+ 管理面余量（默认 20）；MyBatis SqlSession 为 ThreadLocal 语义，虚拟线程下安全，但禁止跨线程共享 SqlSession/Mapper 实例 |
| 域内事件 | Spring `ApplicationEventPublisher`（Hooks 系统 pre/post 切入点复用同一事件通道） |

### 3.10 沙箱与隔离（替代 isolated-vm）

| 级别 | 方案 | 适用 |
|:---:|------|------|
| L1 | 进程内虚拟线程 + 路径白名单 + 权限网关 | 内置工具（read/write/edit/bash...）默认 |
| L2 | **子进程沙箱**：插件/Hook 以独立 JVM 子进程运行（`ProcessBuilder`），施加内存上限（`-Xmx`）、CPU 时间/墙钟超时、权限清单（允许的工具白名单通过 stdin/stdout JSON-RPC 通信）、崩溃自动重启（指数退避） | 第三方插件/Hooks |
| L3 | 远期：容器级（企业版）或 GraalVM Polyglot JS 引擎进程内强隔离（评估项） | 企业强化 |

**理由**：OS 进程边界的隔离强度高于 V8 Isolate，且无需维护原生绑定；代价是启动开销（~数百 ms），而插件/Hook 调用频率远低于工具调用，可接受。vm2/isolated-vm 类方案在 JVM 世界无直接等价物，子进程是务实正解。

**插件协议（语言无关，ADR-011）**：宿主与插件/Hook 子进程之间以 stdin/stdout newline-delimited JSON-RPC 通信——Node.js/Python/Shell 等任意运行时可执行文件均可作为插件载体（覆盖原文档 TS/Python/Shell 自定义工具场景）；npm 包/WASM 打包分发形态延后（§11 O14）。

### 3.11 任务调度（SCHED 域, v0.4 启用）

| 维度 | 结论 |
|------|------|
| 选型 | **Spring @Scheduled + DB 驱动动态调度器** |
| 落地模式 | `ScheduledDefinitionPoller` 以 `@Scheduled(fixedDelay=30s)` 轮询 `scheduled_tasks` 表 → diff 同步到内存 `TaskScheduler` 注册表 → 到期触发虚拟线程执行 Agent 任务 → 写 `scheduled_task_runs` 执行日志 |
| 四种触发 | cron（Spring CronExpression）/ interval（fixedDelay 换算）/ once（延时任务）/ event（订阅 ApplicationEvent） |
| 限制声明 | 仅支持**单实例**；v0.2 多实例部署时平滑升级 Quartz JDBC JobStore（调度器藏在 `SchedulerPort` 接口之后，替换不动业务） |

### 3.12 辅助工具链

| 能力 | 选型 | 版本线 | 备注 |
|------|------|--------|------|
| Git 操作 | **JGit**（Eclipse）+ 系统 git CLI 兜底（ProcessBuilder） | 6.x+ | blame/large repo 等 JGit 弱项走 CLI，与原 simple-git 依赖系统 git 的假设一致 |
| 文件监听 | **io.methvin:directory-watcher** | 0.19+ | 正确处理递归监听；IntelliJ/sbt 生态验证；替代裸 WatchService |
| PTY 终端 (v0.2) | **pty4j**（JetBrains，IntelliJ 终端内核） | 0.13+ | 配合前端 xterm.js over WebSocket；v0.1 的 run_command 用 ProcessBuilder 捕获输出即可 |
| HTML→Markdown (web_fetch) | **jsoup**（解析/清洗）+ **flexmark** html-converter（转换） | 1.18+ / 0.64+ | |
| 运行时 Schema 校验 | **com.networknt:json-schema-validator** | 1.x | LLM 产出的 tool args 分发前校验（victools 仅 build 期生成，不承担运行时校验） |
| ID 生成 | **com.github.f4b6a3:uuid-creator**（UUIDv7） | 5.x | 对齐原 nanoid 语义：时间有序、无协调服务；06 DDL 主键注释的 nanoid 由其替代 |
| HTTP 客户端 | **JDK 内置 java.net.http.HttpClient** | 21 | web_search/web_fetch/MCP SSE 底座，零新增依赖；LangChain4j 自带 client 不受影响 |
| 数据导出/导入 | java.util.zip + Jackson（JSONL/CSV） | 内置 | bundle zip / 会话导出 / 审计导出管线；竞品格式转换延后（§11 O12） |
| 国际化 (i18n) | Spring MessageSource（ResourceBundle） | Boot 内置 | 承载 L5 i18n 需求，无额外依赖 |
| Prompt 模板 | **Handlebars.java**（com.github.jknack） | 4.x | 与原 Handlebars 选型语义一致，七层洋葱模板直接移植 |
| JSON/Schema (生成) | **Jackson**（Boot 默认）+ **com.github.victools:jsonschema-generator** | 2.17+ / 4.x | build 期 DTO→JSON Schema→前端 Zod（§4.2）；运行时校验见上行 networknt |
| Key 存储 | **java-keyring**（Win 凭据管理器/macOS Keychain/Linux Secret Service）+ AES-GCM 文件主密钥回退（JCA 标准库） | ⚠️ 许可证待核实（§11） | 回退路径保证跨平台可用性 |
| 密码学 | JDK JCA：AES-GCM（API Key 落库加密）、SHA-256（代码指纹）、Ed25519 可选（审计签名防篡改） | — | 无第三方依赖 |

### 3.13 桥接与外部世界工具（补齐原设计 Bridge 层）

原设计（04 文档 §7）包含 LSP/Editor/Terminal/Browser 四类 Bridge，此前映射表未覆盖，现补齐：

| 工具域 | 选型 | 版本线 | 阶段 |
|--------|------|--------|------|
| `diagnostics` (LSP) | **org.eclipse.lsp4j**（LSP 协议 Java 绑定）+ 按语言外挂 LSP Server 子进程 | 最新稳定 | v0.2 |
| `browser_*` | **Playwright Java**（复用 E2E 测试栈同一依赖，CDP 驱动本地浏览器） | 1.5x | v0.2 |
| `web_search` | 可插拔 `SearchProviderPort`：SearXNG（自托管）/ Tavily / Bing API 三实现，经 JDK HttpClient 接入 | — | v0.2（默认 Provider PoC 见 §11 O13） |
| `editor_action` | Web Client 形态下由前端编辑器通道执行（Monaco 命令 API），后端仅下发指令 | — | v0.1 |

---

### 4.1 锁定清单（以 05 文档 §4/§6 的 v4.3 重置值为准；注意 05 §19 总表仍残留 @lobehub/node-pty 等陈旧条目，不作为依据）

| 域 | 技术 | 版本 |
|----|------|------|
| 框架 | React + TypeScript + Vite | 19.1 / 5.7 / 6.x |
| UI 组件 | Ant Design v5 + Tailwind CSS v4 双轨 | ^5.22 / ^4.0 |
| 面板布局 | react-resizable-panels | ^2.1 |
| 代码编辑器 | Monaco Editor (@monaco-editor/react) | ^0.55 / ^4.7 |
| AI 输入编辑器 | TipTap v2 (+ 自建 CommandChip/FileMention/Attachment 节点) | ^2.10 |
| 终端渲染 | xterm.js (@xterm/addon-fit/web-links/search) | ^5.3 |
| Markdown | react-markdown + remark/rehype 插件链 (gfm/math/katex/highlight) | ^9.0 |
| 状态管理 | Zustand | ^5.0 |
| 校验 | Zod | ^3.23 |
| 虚拟滚动 | @tanstack/react-virtual | ^3.x |
| 动画 | framer-motion | ^11.x |

### 4.2 前后端契约同步流水线

```
openwork-api (Java DTO, 唯一真源)
   │  victools json-schema-generator (Maven 插件, build 期)
   ▼
json-schema 产物 (openwork-api-schema.json)
   │  json-schema-to-zod (npm script)
   ▼
frontend/src/api-client/schema.ts  →  Zod schema + 推导 TS 类型
```

规则：前后端**禁止手写对方侧类型**；CI 校验 schema 产物无 diff 漂移。

---

## 5. Repository 多层隔离设计 (DDD)

### 5.1 设计目标

继承 04 文档 §11.9「DDD Repository 契约与实现隔离」，并因数据源从单一 SQLite 扩展为 **PG / Milvus / ES 三类异构数据源**而升级为**多层 Port 隔离**：

- domain/application 层只见接口，不见任何驱动类；
- 任一数据源可整体替换（ES→OpenSearch、pgvector→Milvus、PG→H2 演示档）而不触碰业务代码；
- ArchUnit 把隔离规则变成可执行测试（§6.2）。

### 5.2 接口分层清单

```
com.openwork.core.domain.repository      # 聚合仓储接口 (CRUD/查询/事务边界)
├── SessionRepository                    # sessions
├── MessageRepository                    # messages
├── ToolCallRepository                   # tool_calls
├── LoopStepRepository                   # loop_steps
├── ConfigRepository / ConfigHistoryRepository
├── McpServerRepository / ProfileRepository
├── AuditLogRepository (append-only) / ModelCallRepository / CheckpointRepository
├── EventLogRepository                   # events 表 (SSE 断线重连按 lastEventId 补发的回放窗口)
├── ProviderRepository                   # ... 其余表一一对应 (全集基线见 §3.4 与 §11 O11)

com.openwork.core.domain.port            # 异构数据源 Port (检索与系统能力域)
├── VectorIndexPort                      # upsert / search(vector, topK, filter) / delete
├── KeywordIndexPort                     # index / bm25Search(query, filter)
├── SymbolGraphPort                      # 符号/引用图 (v0.2)
├── SearchProviderPort                   # web_search 可插拔 Provider (SearXNG/Tavily/Bing, §3.13)
├── SecretStorePort                      # Keychain / AES-GCM 文件回退 双实现 (java-keyring 的 Port 化)
└── FileSystemPort                       # 沙箱路径策略注入点 (白名单解析/规范化)

com.openwork.storage.adapter             # infra 实现 (唯一 import 中间件客户端的地方)
├── mybatis/  PgSessionRepository ...    # MyBatis-Plus Mapper + Repository 实现
├── vector/   PgVectorVectorStore | MilvusVectorStore
├── keyword/  EsKeywordStore | PgFtsKeywordStore
└── flyway/   V1__init.sql ...           # 基线 = 06 §2.1 DDL 全集(29 表) PG 化转译; v0.1 启用子集见 O11
```

### 5.3 条件装配示例

```yaml
# application.yml
openwork:
  retrieval:
    vector: pgvector        # pgvector | milvus
    keyword: es             # es | pg-fts
  datasource:
    url: jdbc:postgresql://localhost:5432/openwork
```

```java
@Configuration
class RetrievalConfig {
    @Bean @ConditionalOnProperty(name = "openwork.retrieval.vector", havingValue = "pgvector", matchIfMissing = true)
    VectorIndexPort pgVectorVectorStore(JdbcTemplate jdbc, EmbeddingModel em) { ... }

    @Bean @ConditionalOnProperty(name = "openwork.retrieval.vector", havingValue = "milvus")
    VectorIndexPort milvusVectorStore(MilvusServiceClient client, EmbeddingModel em) { ... }
}
```

---

## 6. 测试与质量工程

### 6.1 测试金字塔

| 层级 | 工具 | 覆盖率目标 | Mock 策略 |
|------|------|:---:|------|
| 单元测试 (60%) | **JUnit 5 + AssertJ + Mockito** | 行覆盖 ≥70% | Mock 所有 Port/Repository |
| 架构守护 | **ArchUnit** | 规则 100% 通过 | — （§6.2） |
| 集成测试 (30%) | **Testcontainers**（`pgvector/pgvector:pg17` / `elasticsearch:8.x` / milvus 镜像；若某镜像模块不可用则 compose 环境兜底） | 核心模块 ≥60% | 真 PG/ES/Milvus + Mock LLM（固定响应回放） |
| E2E (10%) | **Playwright Java** | 关键路径 100% | 真浏览器 + Mock LLM Provider |

### 6.2 ArchUnit 架构守护规则（保护 DDD 隔离决策）

```java
@AnalyzeClasses(packages = "com.openwork")
class ArchitectureTest {
    @ArchTest static final ArchRule domainPurity = noClasses()
        .that().resideInAPackage("com.openwork.core.domain..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "com.openwork.storage.adapter.."); // domain 只认接口, 不见实现

    @ArchTest static final ArchRule noMiddlewareInCore = noClasses()
        .that().resideOutsideOfPackage("com.openwork.storage.adapter..")
        .should().dependOnClassesThat().resideInAnyPackage(
            "org.elasticsearch..", "io.milvus..",
            "org.apache.ibatis..", "org.testcontainers..");
}
```

### 6.3 LLM 测试策略

- 单测：Mock `AiProviderAdapter`，固定事件序列回放；
- 集成：录制真实响应（cassette 式 JSONL）回放断言流程正确性而非精确输出；
- E2E：低成本模型或预录制响应；预算熔断逻辑单独注入测试。

---

## 7. 构建、打包与供应链安全

| 项 | 方案 |
|----|------|
| 构建编排 | Maven 多模块 + BOM（spring-boot-dependencies / langchain4j-bom / mcp-bom）+ `dependencyManagement` 中央锁定 |
| 前端编排 | **frontend-maven-plugin**：`mvn package` 内自动执行 npm ci + vite build，产物并入 openwork-app 静态资源（单 jar 交付） |
| 本地联调 | 前端 `npm run dev`（Vite DevServer + proxy）↔ 后端 `mvn spring-boot:run` 双进程；中间件 `docker compose up -d` |
| Docker | spring-boot 分层 jar + 标准 dockerfile；`docker-compose.dev.yml`（postgres+pgvector 必启；elasticsearch 默认；milvus 用 profile 按需） |
| CI (GitHub Actions) | `mvn verify`（含 Testcontainers 集成测试 + ArchUnit）→ Playwright E2E → **OWASP dependency-check**（CVE 扫描，阻断 HIGH+）→ **CycloneDX SBOM** 产物归档 |
| 代码规范 | Spotless + google-java-format + EditorConfig + ErrorProne（可选） |
| 发布物 (v0.1) | fat-jar + docker image；安装包（jpackage/桌面壳）延后 |

---

## 8. 与原 TS 方案逐项映射总表

| 技术域 | 原 TS 方案 (05 文档) | Java 实施方案 (本文档) | 性质 |
|--------|---------------------|----------------------|------|
| 桌面框架 | Electron 35 + electron-vite | **移除**（Web Client 先行，壳打包延后） | 形态变更 |
| 后端运行时 | Node.js 22 + Worker Threads | Java 21 LTS + 虚拟线程 | 替换 |
| 框架基座 | Fastify 5 + ws | Spring Boot 3.5.x (MVC SSE + spring-websocket) | 替换 |
| 协议 | JSON-RPC 2.0 自实现 (TS) | JSON-RPC 2.0 自实现 (Java/Jackson) | 同构移植 |
| API 契约包 | @opencode/api | openwork-api | 更名+换语言 |
| Agent 核心 | @opencode/core (Worker Threads) | openwork-core (虚拟线程) | 替换 |
| LLM SDK | openai / @anthropic-ai/sdk | LangChain4j 1.x | 替换 |
| MCP | @modelcontextprotocol/sdk (JS) | io.modelcontextprotocol.sdk:mcp (官方 Java) | 替换 |
| Token 计数 | tiktoken | jtokkit | 替换 |
| 数据库 | SQLite (better-sqlite3) WAL | PostgreSQL 17 (JDBC/HikariCP) | **变更** |
| 向量索引 | sqlite-vec / LanceDB | pgvector (默认) / Milvus (大规模) | **变更** |
| 全文搜索 | SQLite FTS5 | Elasticsearch 8 + IK (默认) / PG tsvector 备选 | **变更** |
| ORM/查询 | Drizzle ORM (候选) | MyBatis-Plus 3.5.x | 替换 |
| 迁移 | 手写 migration + schema_migrations 表 | Flyway 10.x+ | 升级 |
| 代码解析 | web-tree-sitter (WASM) | 见 §11 开放问题 O1（tree-sitter JNI 绑定 / 语言专用解析器 PoC 后定） | 待定 |
| 文件监听 | chokidar | io.methvin:directory-watcher | 替换 |
| Git | simple-git | JGit + git CLI 兜底 | 替换 |
| 模板引擎 | Handlebars (JS) | Handlebars.java | 同构移植 |
| 沙箱 | Worker Threads + isolated-vm | 虚拟线程 + 子进程沙箱 (ProcessBuilder) | 模型更换 |
| 调度 | node-cron 3.x | Spring @Scheduled + DB 驱动动态调度器 | 替换 |
| CLI 框架 | Commander.js | picocli（仅承担 openwork-app 启动参数 serve/--port/--token 与诊断子命令，非独立 CLI 客户端；TUI/CLI 客户端延后） | 替换 |
| TUI | Ink 5 | Lanterna / JLine 3（v0.2+ 再选型） | 延后 |
| 状态校验 (前端) | Zod | Zod (schema 由后端 JSON Schema 生成) | 增强 |
| 前端 UI 全家桶 | React/antd/Tailwind/Monaco/xterm/TipTap/react-markdown/react-resizable-panels/Zustand | **不变** | 保留 |
| 构建 | Vite 6 + Turborepo + npm workspaces | Maven 多模块 + frontend-maven-plugin (前端仍 Vite) | 替换 |
| 测试 | Vitest + Playwright | JUnit 5 + AssertJ + Mockito + ArchUnit + Testcontainers + Playwright Java | 替换+增强 |
| 供应链 | lockfile 审计 | OWASP dependency-check + CycloneDX SBOM | 增强 |

---

## 9. 依赖版本锁定总表

> 版本为版本线；实施时经 BOM 锁定精确版本，CI 中 dependency-check 保证无高危 CVE。

### 9.1 后端 (backend/)

| 域 | 依赖 (groupId:artifactId) | 版本线 | 许可证 |
|----|---------------------------|--------|--------|
| 运行时 | Eclipse Temurin JDK | 21 LTS | GPLv2+CE |
| 框架 | org.springframework.boot:spring-boot-starter-{web,websocket,actuator,validation} | 3.5.x | Apache-2.0 |
| ORM | com.baomidou:mybatis-plus-spring-boot3-starter | 3.5.x | Apache-2.0 |
| 迁移 | org.flywaydb:flyway-core (+ flyway-database-postgresql) | 10.x+ | Apache-2.0 |
| 驱动 | org.postgresql:postgresql | 42.7.x | BSD-2 |
| LLM | dev.langchain4j:* (bom) | 1.x | Apache-2.0 |
| MCP | io.modelcontextprotocol.sdk:mcp | 跟随最新稳定 | MIT |
| Token | com.knuddels:jtokkit | 1.x | MIT |
| 检索客户端 | co.elastic.clients:elasticsearch-java (+ analysis-ik 为 ES 插件, 随镜像安装) | 8.x | Apache-2.0 |
| 检索客户端 (可选档) | io.milvus:milvus-sdk-java | 2.5+ | Apache-2.0 |
| EmbeddingStore | dev.langchain4j:langchain4j-pgvector / langchain4j-milvus / langchain4j-elasticsearch | 1.x (bom) | Apache-2.0 |
| 运行时校验 | com.networknt:json-schema-validator | 1.x | Apache-2.0 |
| ID 生成 | com.github.f4b6a3:uuid-creator | 5.x | MIT |
| LSP (v0.2) | org.eclipse.lsp4j:org.eclipse.lsp4j | 最新稳定 | EPL-2.0 |
| Git | org.eclipse.jgit:org.eclipse.jgit | 6.x+ | EDL(BSD-3)/EPL |
| 监听 | io.methvin:directory-watcher | 0.19+ | Apache-2.0 |
| PTY (v0.2) | org.jetbrains.pty4j:pty4j | 0.13+ | EPL-1.0（混含 MIT 组件，Phase 0 复核） |
| 解析 | org.jsoup:jsoup | 1.18+ | MIT |
| MD 转换 | com.vladsch.flexmark:flexmark-html-converter | 0.64+ | BSD-2 |
| 模板 | com.github.jknack:handlebars | 4.x | Apache-2.0 |
| Schema 生成 | com.github.victools:jsonschema-generator | 4.x | Apache-2.0 |
| Keychain | com.github.javakeyring:java-keyring | 1.x | ⚠️ 待核实 |
| CLI | info.picocli:picocli | 4.7.x | Apache-2.0 |
| 测试 | org.junit.jupiter / org.assertj / org.mockito / org.testcontainers / com.tngtech.archunit / com.microsoft.playwright | 各最新稳定 | 见 §10 |
| 安全扫描 | org.owasp:dependency-check-maven / org.cyclonedx:cyclonedx-maven-plugin | 最新稳定 | Apache-2.0 |

### 9.2 中间件 (docker-compose)

| 组件 | 镜像 | 版本线 | 许可证 |
|------|------|--------|--------|
| 主数据库 | postgres + pgvector 扩展 (pgvector/pgvector:pg17 或等效) | PG 17 / pgvector 0.8+ | PostgreSQL License |
| 关键词检索 | elasticsearch (+ analysis-ik 插件) | 8.x | AGPL/ELv2 ⚠️（OpenSearch 2.x Apache-2.0 平替备选） |
| 向量检索 (可选档) | milvusdb/milvus standalone (+etcd/minio 依赖容器) | 2.5+ | Apache-2.0 |

### 9.3 前端 (frontend/) — 以 05 文档 §4/§6 v4.3 重置值为准（05 §19 存在陈旧条目，勿引用）

React 19.1 / antd ^5.22 / tailwindcss ^4.0 / vite ^6.0 / monaco-editor ^0.55 / @xterm/xterm ^5.3 / @tiptap/react ^2.10 / zustand ^5.0 / zod ^3.23 / react-resizable-panels ^2.1 / react-markdown ^9.0 及 rehype/remark 插件链 / @tanstack/react-virtual ^3 / framer-motion ^11。

---

## 10. 许可证合规矩阵

| 许可证 | 依赖 | 与 MIT 主协议兼容性 |
|--------|------|---------------------|
| Apache-2.0 | Spring Boot / MyBatis-Plus / Flyway / LangChain4j（含 store 模块）/ directory-watcher / handlebars.java / victools / picocli / **Playwright** / elasticsearch-java / Milvus SDK / networknt validator / OpenSearch(备选) | ✅ 兼容 |
| MIT | MCP Java SDK / jsoup / jtokkit / Mockito / Testcontainers / uuid-creator / 前端全系 | ✅ 兼容 |
| EPL | JUnit 5 (EPL-2.0) / lsp4j (EPL-2.0) / pty4j (EPL-1.0, jar 依赖形式使用) | ✅ 兼容（jar 依赖，非静态链接修改） |
| Apache-2.0 | AssertJ / ArchUnit(以 jar 依赖使用；仍列入 O4 复核) | ✅ 兼容 |
| BSD-2/BSD-3/EDL | postgresql-jdbc / flexmark / JGit | ✅ 兼容 |
| PostgreSQL License | PostgreSQL / pgvector | ✅ 兼容 |
| GPLv2 + Classpath Exception | Temurin JDK（运行时不构成分发传染） | ✅ 运行时使用兼容 |
| AGPL-3.0 / ELv2 | Elasticsearch 8 ⚠️ | 自托管内部使用无碍；若产品需捆绑分发 ES 则切换 **OpenSearch 2.x (Apache-2.0)**——KeywordIndexPort 隔离使替换零成本 |
| LGPL 类 | java-keyring ⚠️ 待核实 / ArchUnit ⚠️ 待核实 | 若核实为 LGPL 且以 jar 依赖（非静态链接修改）形式使用通常可行；如有顾虑分别换 JNA 自封装凭据访问 / 自写分层规则测试 |
| EPL | pty4j 部分 ⚠️ 复核 | 同上按依赖形式评估 |

> 合规流程：CI 的 CycloneDX SBOM 步骤输出全部传递依赖许可证清单，许可证变更在升级评审中强制检查。上表 ⚠️ 项在 Phase 0 工程搭建时优先复核（§11 O4）。

---

## 11. 风险清单与开放问题

| # | 风险/开放问题 | 影响 | 缓解/计划 |
|---|--------------|------|----------|
| O1 | **代码解析选型未定**（原 web-tree-sitter 无成熟 JVM 等价物） | 索引器符号抽取质量 | Phase 0 PoC 三案：① tree-sitter JNI 绑定（社区 wrapper）② 语言专用解析器（JavaParser/Eclipse JDT 等，逐语言接入）③ 外部 tree-sitter CLI sidecar。降级兜底：按行/按块切分 + 正则启发式 |
| O2 | LangChain4j 1.x API 仍在演进 | Provider 适配层返工 | 项目契约 `AiProviderAdapter` 隔离在其之上（§3.7），LangChain4j 仅出现在 storage-like 适配层 |
| O3 | MCP Java SDK 版本演进快 | 协议跟进 | openwork-mcp 单模块封装，升级面收敛 |
| O4 | java-keyring / ArchUnit / pty4j 许可证待核实 | 合规 | Phase 0 复核；备选：JNA 自封装 DPAPI/Keychain、自写架构测试、延迟 pty4j 到 v0.2 评审 |
| O5 | ES 许可证（AGPL/ELv2）对分发场景的影响 | 商业分发 | 自托管不受影响；需捆绑分发时切 OpenSearch（Port 隔离保证零成本替换） |
| O6 | Milvus 开发环境重量（etcd+minio） | DX | compose profile 按需启动；默认档 pgvector |
| O7 | @Scheduled 单实例限制 | 多实例扩展 | SchedulerPort 接口预留；v0.2 升级 Quartz JDBC JobStore，业务零改动 |
| O8 | 虚拟线程 pinning（synchronized 热路径） | 吞吐劣化 | 编码规约 + 压测基线；JDK 升级路线已含 JEP 491 修复 |
| O9 | 中文分词质量（IK vs zhparser） | 检索相关性 | Phase 0 用真实语料 A/B 对比后定默认值 |
| O10 | 结构化并发仍为 preview | API 稳定 | Sub-Agent 先用虚拟线程池 + CompletableFuture；转正后切换 |
| O11 | **表基线对齐**：01/04 称"20 表"，06 §2.1 实际 29 张 DDL；且两处 "v0.1 12 表" 子集清单不一致（01 含 providers/model_calls/config_history/mcp_servers，06 另含 projects/events/schema_version/secrets） | Flyway V1 无法落地、Repository 清单歧义 | Phase 0 以 06 DDL 全集为准产出 PG 化基线脚本；v0.1 启用子集对照 02 PRD REQ-DATA 锁定，并在 06 文档出勘误 |
| O12 | 平台能力域未选型：遥测开关/崩溃上报/A-B 实验/fat-jar 自动更新、竞品数据格式导入转换 | 产品闭环缺口（01 §4.13/§4.8） | 登记 v0.2+ 专项；遥测默认关闭；自动更新 v0.1 仅做启动版本检查提示；导入转换延后 |
| O13 | web_search 默认 Provider 未 PoC（SearXNG/Tavily/Bing） | P0 网络工具验收（02 PRD） | SearchProviderPort 已隔离（§3.13），Phase 0 三实现 PoC 后定默认 |
| O14 | 非 JVM 插件分发形态（npm 包/WASM 打包） | 插件生态分发 | 执行协议已语言无关（§3.10），分发格式 v0.3 再定 |

---

## 附录 A: 选型决策记录 (ADR)

| ADR | 决策 | 备选被拒原因 | 日期 |
|-----|------|-------------|------|
| ADR-001 | 客户端形态 = Java 服务 + 浏览器 Web Client | Electron 壳（双运行时、包体重）；JavaFX 纯桌面（UI 重写量巨大、生态弱）；Compose Desktop（引入 Kotlin，非纯 Java 栈） | 2026-08-26 |
| ADR-002 | 框架基座 = Spring Boot 3.5.x | Quarkus/Micronaut（生态小、LLM 集成手动接线）；纯 JDK（造轮子） | 2026-08-26 |
| ADR-003 | LLM 接入 = LangChain4j | Spring AI（Provider 覆盖窄）；官方 SDK 自建适配（工作量与漂移风险） | 2026-08-26 |
| ADR-004 | 构建 = Maven 多模块 | Gradle Kotlin DSL（团队成本、脚本可维护性） | 2026-08-26 |
| ADR-005 | 数据访问 = MyBatis-Plus | JDBI 3（备胎保留）；Spring Data JDBC（聚合映射限制）；jOOQ（AGPL 商用授权风险） | 2026-08-26 |
| ADR-006 | 主数据库 = PostgreSQL + pgvector（弃 SQLite） | 用户决策：服务化部署 + 中间件栈；Repository 隔离保留轻量回退能力 | 2026-08-26 |
| ADR-007 | 检索 = VectorIndexPort(pgvector\|Milvus) + KeywordIndexPort(ES+IK\|PgFts) + RRF；向量路直接采用 langchain4j-pgvector/milvus 官方 EmbeddingStore 模块 | Lucene 嵌入式（被 PG+中间件栈决策取代）；外置全家桶为默认档（运维过重）；自写 pgvector 适配器（违背避免造轮子原则，仅留作官方模块不足时的备胎） | 2026-08-26 |
| ADR-008 | 调度 = Spring @Scheduled + DB 驱动动态调度器 | Quartz（重，留作多实例升级路径）；db-scheduler（未采纳）；纯 @Scheduled 内存态（不满足持久化需求，故加 Poller 模式补齐） | 2026-08-26 |
| ADR-009 | 沙箱 = 子进程沙箱替代 isolated-vm | JVM 无 V8 Isolate 等价物；OS 进程边界隔离更强、免原生维护 | 2026-08-26 |
| ADR-010 | 命名 = openwork-* / com.openwork | siren 为 worktree 名不作命名依据；历史 OpenCoding 代号废弃 | 2026-08-26 |
| ADR-011 | 插件/Hook 执行协议 = 语言无关子进程 stdin/stdout ND-JSON RPC | JVM-only 插件宿主（切断 Node/Python 生态）；进程内 GraalVM polyglot（隔离弱于 OS 边界，列远期评估） | 2026-08-26 |
| ADR-012 | 配置热加载 = PG LISTEN/NOTIFY + 异常降级轮询 | 纯轮询（延迟高）；Spring Cloud Bus（引入 MQ 过重） | 2026-08-26 |
| ADR-013 | ID = UUIDv7 (uuid-creator) 替代原 nanoid | 自实现 nanoid 算法（造轮子）；PG 内置 gen_random_uuid() 为 v4 无序（索引局部性差） | 2026-08-26 |
