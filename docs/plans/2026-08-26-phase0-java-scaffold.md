# Phase 0 — Java 工程骨架与基础设施验证 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 OpenWork Java 后端 Maven 多模块骨架 + Web 前端脚手架 + 中间件开发环境，使 `mvn verify` 全绿、`docker compose up` 可用、应用可启动并通过 Testcontainers 集成测试。

**Architecture:** 按《09-技术选型与架构方案(Java实施版)》§2 落地 7 个 Maven 模块的空壳结构与依赖方向；Flyway 建 v0.1 核心表基线；Spring Boot 应用装配虚拟线程 + Actuator；ArchUnit 锁定 DDD 分层规则；旧 TS/Electron 存量代码归档移除，前端以独立 Vite 工程重建并由 frontend-maven-plugin 打进单 jar。

**Tech Stack:** JDK 21 / Spring Boot 3.5.x / Maven 多模块 / PostgreSQL 17+pgvector / Elasticsearch 8+IK / Flyway / MyBatis-Plus / Testcontainers / ArchUnit / Vite + React 19 + antd v5

## Global Constraints

以下约束来自 `docs/design/09-技术选型与架构方案(Java实施版).md`，所有任务隐式遵守：

- JDK **21**（Temurin），`spring.threads.virtual.enabled=true`
- Spring Boot **3.5.x**（parent = spring-boot-starter-parent）
- groupId=`com.openwork`，artifactId 前缀 `openwork-*`，Java 包根 `com.openwork.*`，配置前缀 `openwork.*`
- 模块清单：`openwork-api / openwork-core / openwork-tools / openwork-mcp / openwork-storage / openwork-server / openwork-app`，位于 `backend/` 下
- 依赖方向：api ← core ← tools/mcp ← server ← app；**domain 接口归 core 所有，storage 单向依赖 core 并实现接口**
- 数据库 PostgreSQL 17 + pgvector；表结构权威基线 = 06 文档 §2.1 DDL 全集（29 表）经类型映射转译，Phase 0 仅建核心 8 表，其余随领域计划增量追加（开放问题 O11）
- 提交信息：conventional commits 中文主题，与仓库历史一致
- 开发机为 Windows（bash 可用）；所有命令在仓库根执行除非另有说明

## 与存量代码的关系（重要背景）

仓库现存 TS/Electron 骨架（`apps/desktop`、`packages/{api,core,server,transport-*}`、`turbo.json`、根 `package.json`/`tsconfig*`）属于已废弃的 v4.3 技术栈。本计划 Task 6 将其从工作区移除（git 历史保留）；React 渲染器代码因深度耦合 Electron IPC Transport 不做文件级迁移，UI 在后续前端计划中参照重写。

---

### Task 1: Maven 根 POM 与七模块骨架

**Files:**
- Create: `backend/pom.xml`
- Create: `backend/openwork-api/pom.xml`
- Create: `backend/openwork-core/pom.xml`
- Create: `backend/openwork-tools/pom.xml`
- Create: `backend/openwork-mcp/pom.xml`
- Create: `backend/openwork-storage/pom.xml`
- Create: `backend/openwork-server/pom.xml`
- Create: `backend/openwork-app/pom.xml`

**Interfaces:**
- Produces: 后续所有任务的 Maven 坐标 `com.openwork:<module>`；父 POM 统一管理 Spring Boot 3.5.x 与 LangChain4j BOM 版本；`mvn -q validate` 通过

- [ ] **Step 1: 创建根聚合 POM**

写入 `backend/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.5.4</version>
        <relativePath/>
    </parent>

    <groupId>com.openwork</groupId>
    <artifactId>openwork-backend</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <packaging>pom</packaging>
    <name>OpenWork Backend</name>

    <modules>
        <module>openwork-api</module>
        <module>openwork-core</module>
        <module>openwork-tools</module>
        <module>openwork-mcp</module>
        <module>openwork-storage</module>
        <module>openwork-server</module>
        <module>openwork-app</module>
    </modules>

    <properties>
        <java.version>21</java.version>
        <maven.compiler.release>21</maven.compiler.release>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <langchain4j.version>1.2.0</langchain4j.version>
    </properties>

    <dependencyManagement>
        <dependencies>
            <dependency>
                <groupId>dev.langchain4j</groupId>
                <artifactId>langchain4j-bom</artifactId>
                <version>${langchain4j.version}</version>
                <type>pom</type>
                <scope>import</scope>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-api</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-core</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-tools</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-mcp</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-storage</artifactId>
                <version>${project.version}</version>
            </dependency>
            <dependency>
                <groupId>com.openwork</groupId>
                <artifactId>openwork-server</artifactId>
                <version>${project.version}</version>
            </dependency>
        </dependencies>
    </dependencyManagement>

    <build>
        <pluginManagement>
            <plugins>
                <plugin>
                    <groupId>org.springframework.boot</groupId>
                    <artifactId>spring-boot-maven-plugin</artifactId>
                    <configuration>
                        <mainClass>com.openwork.app.OpenWorkApplication</mainClass>
                    </configuration>
                </plugin>
            </plugins>
        </pluginManagement>
    </build>
</project>
```

> 版本说明：`3.5.4` 为编写时的 3.5.x 补丁线，执行时改为 `https://repo.maven.apache.org` 上 3.5.x 最新 patch。LangChain4j 本计划不引入代码依赖，仅锁定 BOM 备用。

- [ ] **Step 2: 创建四个纯契约/引擎占位模块 POM**

`backend/openwork-api/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-api</artifactId>
    <name>OpenWork API Contract</name>
    <description>L3 API 契约层: JSON-RPC 方法契约 + DTO + 事件类型 (唯一类型真源, 禁止中间件依赖)</description>

    <dependencies>
        <dependency>
            <groupId>com.fasterxml.jackson.core</groupId>
            <artifactId>jackson-annotations</artifactId>
        </dependency>
    </dependencies>
</project>
```

`backend/openwork-core/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-core</artifactId>
    <name>OpenWork Core Engine</name>
    <description>L6-L8: PAOR Loop / Prompt / Context / Harness / Provider 抽象与 domain 接口</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-api</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-context</artifactId>
        </dependency>
    </dependencies>
</project>
```

`backend/openwork-tools/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-tools</artifactId>
    <name>OpenWork Built-in Tools</name>
    <description>L7: 内置工具集 (read/write/edit/bash/git/glob/grep/web_fetch/...)</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-core</artifactId>
        </dependency>
    </dependencies>
</project>
```

`backend/openwork-mcp/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-mcp</artifactId>
    <name>OpenWork MCP Client</name>
    <description>L7: MCP Client 封装 (官方 io.modelcontextprotocol.sdk:mcp)</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-core</artifactId>
        </dependency>
    </dependencies>
</project>
```

- [ ] **Step 3: 创建 openwork-storage POM（含持久化全量依赖）**

`backend/openwork-storage/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-storage</artifactId>
    <name>OpenWork Storage Adapters</name>
    <description>L9: Repository/Port 实现 (MyBatis-Plus/Flyway/ES/Milvus/pgvector)。唯一允许 import 中间件客户端的模块</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-jdbc</artifactId>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>3.5.12</version>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <!-- 测试 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>com.tngtech.archunit</groupId>
            <artifactId>archunit-junit5</artifactId>
            <version>1.4.0</version>
            <scope>test</scope>
        </dependency>
    </dependencies>
</project>
```

- [ ] **Step 4: 创建 openwork-server POM**

`backend/openwork-server/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-server</artifactId>
    <name>OpenWork Server Host</name>
    <description>L4-L5: Transport (HTTP+SSE/WebSocket) + JSON-RPC Dispatcher + 会话/权限编排</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-api</artifactId>
        </dependency>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-websocket</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
    </dependencies>
</project>
```

- [ ] **Step 5: 创建 openwork-app POM**

`backend/openwork-app/pom.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <parent>
        <groupId>com.openwork</groupId>
        <artifactId>openwork-backend</artifactId>
        <version>0.1.0-SNAPSHOT</version>
    </parent>
    <artifactId>openwork-app</artifactId>
    <name>OpenWork Application</name>
    <description>可执行入口: Spring Boot fat-jar (含静态资源), 未来 jpackage 打包源</description>

    <dependencies>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-server</artifactId>
        </dependency>
        <dependency>
            <groupId>com.openwork</groupId>
            <artifactId>openwork-storage</artifactId>
        </dependency>
        <!-- 测试: Testcontainers 集成测试 -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-testcontainers</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>junit-jupiter</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

- [ ] **Step 6: 各模块建立标准目录并验证**

```bash
for m in api core tools mcp storage server app; do
  mkdir -p backend/openwork-$m/src/main/java/com/openwork/$m
  mkdir -p backend/openwork-$m/src/main/resources
  mkdir -p backend/openwork-$m/src/test/java/com/openwork/$m
done
```

在每个模块的包根放一个占位类以保证编译（后续任务会替换为真实内容）：

`backend/openwork-api/src/main/java/com/openwork/api/package-info.java`：
```java
/**
 * OpenWork L3 API 契约层。唯一类型真源：JSON-RPC 方法契约、DTO、事件类型。
 * 禁止依赖除 jackson-annotations 外的任何第三方库（ArchUnit 守护）。
 */
package com.openwork.api;
```

`backend/openwork-core/src/main/java/com/openwork/core/package-info.java`、`backend/openwork-tools/.../tools/package-info.java`、`backend/openwork-mcp/.../mcp/package-info.java`、`backend/openwork-server/.../server/package-info.java` 同理（各自描述层职责，包名对应）。

运行: `cd backend && mvn -q validate`
预期: BUILD SUCCESS，无报错。

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat(backend): 搭建 Maven 七模块骨架与父 POM (Spring Boot 3.5.x/JDK21)"
```

---

### Task 2: docker-compose 开发环境（PostgreSQL+pgvector / ES+IK / Milvus profile）

**Files:**
- Create: `docker-compose.dev.yml`
- Create: `docker/es-ik/Dockerfile`

**Interfaces:**
- Produces: `localhost:5432`（postgres/openwork/openwork 密码）、`localhost:9200`（ES）、`--profile vector-scale` 下的 Milvus `localhost:19530`；供 Task 4 手动联调与后续计划使用

- [ ] **Step 1: 写入 docker-compose.dev.yml**

```yaml
# OpenWork 开发环境中间件。用法:
#   docker compose -f docker-compose.dev.yml up -d                  # 默认档: PG + ES
#   docker compose -f docker-compose.dev.yml --profile vector-scale up -d   # 加 Milvus
services:
  postgres:
    # 官方 pgvector 组合镜像 (PostgreSQL 17 + pgvector 扩展)
    image: pgvector/pgvector:pg17
    container_name: openwork-postgres
    environment:
      POSTGRES_DB: openwork
      POSTGRES_USER: openwork
      POSTGRES_PASSWORD: openwork
    ports:
      - "5432:5432"
    volumes:
      - ./.docker-data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openwork -d openwork"]
      interval: 5s
      timeout: 3s
      retries: 10

  elasticsearch:
    build: ./docker/es-ik          # ES 8.x + IK 中文分词插件
    container_name: openwork-es
    environment:
      discovery.type: single-node
      xpack.security.enabled: "false"
      ES_JAVA_OPTS: "-Xms512m -Xmx512m"
    ports:
      - "9200:9200"
    volumes:
      - ./.docker-data/es:/usr/share/elasticsearch/data
    healthcheck:
      test: ["CMD-SHELL", "curl -fs http://localhost:9200/_cluster/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 20

  etcd:
    image: quay.io/coreos/etcd:v3.5.18
    container_name: openwork-etcd
    profiles: ["vector-scale"]
    environment:
      ETCD_AUTO_COMPACTION_MODE: revision
      ETCD_AUTO_COMPACTION_RETENTION: "1000"
      ETCD_QUOTA_BACKEND_BYTES: "4294967296"
    command: etcd -advertise-client-urls=http://etcd:2379 -listen-client-urls http://0.0.0.0:2379 --data-dir /etcd
    volumes:
      - ./.docker-data/etcd:/etcd

  minio:
    image: minio/minio:RELEASE.2025-02-28T09-55-16Z
    container_name: openwork-minio
    profiles: ["vector-scale"]
    environment:
      MINIO_ACCESS_KEY: minioadmin
      MINIO_SECRET_KEY: minioadmin
    command: minio server /minio_data
    volumes:
      - ./.docker-data/minio:/minio_data

  milvus:
    image: milvusdb/milvus:v2.5.6
    container_name: openwork-milvus
    profiles: ["vector-scale"]
    command: ["milvus", "run", "standalone"]
    environment:
      ETCD_ENDPOINTS: etcd:2379
      MINIO_ADDRESS: minio:9000
    ports:
      - "19530:19530"
      - "9091:9091"
    depends_on:
      - etcd
      - minio
    volumes:
      - ./.docker-data/milvus:/var/lib/milvus
```

> 执行时将镜像 tag 校正为 Docker Hub 当前最新稳定 patch（pgvector:pg17 固定大版本；milvus v2.5.x；minio 任一近期 RELEASE 即可）。

- [ ] **Step 2: 写入 ES+IK 构建文件**

`docker/es-ik/Dockerfile`：

```dockerfile
# Elasticsearch 8.x + IK 中文分词插件
# IK 插件版本必须与 ES 大版本一致; 执行时到
# https://github.com/infinilabs/analysis-ik/releases 取与基础镜像匹配的 release zip
ARG ES_VERSION=8.18.1
FROM docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}
ENV IK_RELEASE=v8.18.1
RUN elasticsearch-plugin install --batch \
    https://get.infini.cloud/elasticsearch/analysis-ik/${ES_VERSION}
```

- [ ] **Step 3: 启动默认档并验证健康**

```bash
docker compose -f docker-compose.dev.yml up -d postgres elasticsearch
sleep 30
docker compose -f docker-compose.dev.yml ps
curl -s http://localhost:9200 | grep version
docker exec openwork-postgres psql -U openwork -d openwork -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname='vector';"
```

预期: 两容器 healthy；ES 返回 8.x 版本 JSON；psql 输出 pgvector 版本号。

- [ ] **Step 4: Commit**

```bash
git add docker-compose.dev.yml docker/es-ik/Dockerfile
git commit -m "chore(dev): 新增 docker-compose 开发环境 (PG17+pgvector/ES8+IK/Milvus profile)"
```

---

### Task 3: Flyway 基线迁移 V1__init.sql（PG 化核心 8 表）

**Files:**
- Create: `backend/openwork-storage/src/main/resources/db/migration/V1__init.sql`

**Interfaces:**
- Consumes: 06 文档 §2.1 DDL（权威来源）
- Produces: `projects / sessions / messages / events / audit_log / model_calls / configs / config_history` 八张表及索引；Task 4 的集成测试断言这些表存在且可读写

**SQLite→PG 类型映射规则（转译自 06 §2.1，适用于全部 29 表，后续任务沿用）：**

| SQLite 原型 | PG 转译 | 说明 |
|---|---|---|
| `id TEXT PRIMARY KEY -- nanoid` | `id uuid PRIMARY KEY` | 应用侧用 uuid-creator 生成 UUIDv7（ADR-013） |
| 其他外键 `TEXT REFERENCES` | `uuid REFERENCES` | 同上 |
| `INTEGER` 时间戳 (`strftime('%s','now')`) | `timestamptz NOT NULL DEFAULT now()` | PG 原生时间类型 |
| `INTEGER` 0/1 布尔 | `boolean NOT NULL DEFAULT false` | |
| JSON 字符串列 | `jsonb` | 支持索引与操作符 |
| `REAL` | `double precision` | |
| `AUTOINCREMENT` | `bigint generated always as identity` | |
| `CHECK(...)` / 部分索引 (`WHERE ...`) | 原样保留 | PG 全部支持 |

**勘误记录（转写时修正的 06 文档错误）**：`events` 表原文同时声明 `id TEXT PRIMARY KEY` 与 `seq INTEGER PRIMARY KEY` 双主键（非法 SQL）。PG 版以 `seq bigint generated always as identity PRIMARY KEY` 为主键、`id uuid NOT NULL UNIQUE` 保留业务 ID。此勘误需回写 06 文档（后续文档任务处理）。

- [ ] **Step 1: 写入 V1__init.sql**

```sql
-- ============================================================
-- OpenWork V1 基线 (PG17) — Phase 0 核心 8 表
-- 来源: docs/design/06-详细设计文档.md §2.1 (SQLite→PG 映射见实施计划 Task 3)
-- 其余 21 张表随领域计划以 V2+ 增量追加 (开放问题 O11)
-- ============================================================

-- 1. projects -------------------------------------------------
CREATE TABLE projects (
    id              uuid PRIMARY KEY,
    path            text        NOT NULL UNIQUE,
    name            text        NOT NULL,
    description     text,
    root_git_hash   text,
    git_branch      text,
    language        text,
    framework       text,
    package_manager text,
    icon            text,
    color           text,
    settings        jsonb,
    last_opened_at  timestamptz NOT NULL DEFAULT now(),
    pinned          boolean     NOT NULL DEFAULT false,
    archived        boolean     NOT NULL DEFAULT false,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_last_opened ON projects(last_opened_at DESC);
CREATE INDEX idx_projects_pinned      ON projects(pinned, last_opened_at DESC);

-- 2. sessions -------------------------------------------------
CREATE TABLE sessions (
    id                 uuid PRIMARY KEY,
    project_id         uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    profile_id         uuid,
    parent_session_id  uuid,
    parent_step_id     text,
    title              text,
    description        text,
    status             text        NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','paused','archived','forked','abandoned')),
    mode               text        NOT NULL DEFAULT 'build'
        CHECK (mode IN ('ask','plan','build','review')),
    model_snapshot     jsonb,
    profile_snapshot   jsonb,
    token_total_in     integer     NOT NULL DEFAULT 0,
    token_total_out    integer     NOT NULL DEFAULT 0,
    token_total_cache  integer     NOT NULL DEFAULT 0,
    cost_total_usd     double precision NOT NULL DEFAULT 0.0,
    duration_total_ms  bigint      NOT NULL DEFAULT 0,
    message_count      integer     NOT NULL DEFAULT 0,
    step_count         integer     NOT NULL DEFAULT 0,
    tool_call_count    integer     NOT NULL DEFAULT 0,
    sub_agent_count    integer     NOT NULL DEFAULT 0,
    tags               jsonb,
    is_favorite        boolean     NOT NULL DEFAULT false,
    is_pinned          boolean     NOT NULL DEFAULT false,
    termination_reason text,
    termination_detail jsonb,
    last_active_at     timestamptz NOT NULL DEFAULT now(),
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_project  ON sessions(project_id, last_active_at DESC);
CREATE INDEX idx_sessions_status   ON sessions(status);
CREATE INDEX idx_sessions_parent   ON sessions(parent_session_id);
CREATE INDEX idx_sessions_favorite ON sessions(is_favorite, last_active_at DESC);
CREATE INDEX idx_sessions_active   ON sessions(last_active_at DESC) WHERE status = 'active';

-- 3. messages -------------------------------------------------
CREATE TABLE messages (
    id                   uuid PRIMARY KEY,
    session_id           uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq                  integer     NOT NULL,
    role                 text        NOT NULL
        CHECK (role IN ('user','assistant','tool','system','sub_agent')),
    sub_agent_id         text,
    content              jsonb       NOT NULL,
    original_content     jsonb,
    edited_at            timestamptz,
    edited_by            text,
    is_stale             boolean     NOT NULL DEFAULT false,
    is_pinned            boolean     NOT NULL DEFAULT false,
    prompt_snapshot_hash text,
    prompt_snapshot_path text,
    token_in             integer,
    token_out            integer,
    token_cache          integer     DEFAULT 0,
    cost_usd             double precision,
    model_name           text,
    model_provider       text,
    finish_reason        text,
    error_code           text,
    error_message        text,
    metadata             jsonb,
    created_at           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, seq)
);
CREATE INDEX idx_messages_session ON messages(session_id, seq);
CREATE INDEX idx_messages_role    ON messages(session_id, role);
CREATE INDEX idx_messages_created ON messages(created_at);

-- 4. events (勘误: 原 06 文档双主键 → seq 主键 + id 唯一) --------
CREATE TABLE events (
    seq              bigint generated always as identity PRIMARY KEY,
    id               uuid        NOT NULL UNIQUE,
    session_id       uuid        REFERENCES sessions(id) ON DELETE CASCADE,
    source           text        NOT NULL,
    source_id        text,
    event_type       text        NOT NULL,
    event_category   text        NOT NULL
        CHECK (event_category IN ('agent','tool','model','session','config','system','ui','error','lifecycle')),
    payload          jsonb       NOT NULL,
    payload_summary  text,
    severity         text        NOT NULL DEFAULT 'info'
        CHECK (severity IN ('debug','info','warn','error','critical')),
    priority         integer     NOT NULL DEFAULT 0,
    correlated_id    text,
    parent_event_id  bigint      REFERENCES events(seq) ON DELETE SET NULL,
    trace_id         text,
    span_id          text,
    is_persisted     boolean     NOT NULL DEFAULT true,
    is_consumed      boolean     NOT NULL DEFAULT false,
    consumed_by      jsonb,
    subscriber_count integer     NOT NULL DEFAULT 0,
    created_at       timestamptz NOT NULL DEFAULT now(),
    expires_at       timestamptz
);
CREATE INDEX idx_events_seq        ON events(seq);
CREATE INDEX idx_events_session    ON events(session_id, seq);
CREATE INDEX idx_events_type       ON events(event_type, created_at);
CREATE INDEX idx_events_source     ON events(source, created_at);
CREATE INDEX idx_events_severity   ON events(severity, created_at) WHERE severity IN ('warn','error','critical');
CREATE INDEX idx_events_trace      ON events(trace_id) WHERE trace_id IS NOT NULL;
CREATE INDEX idx_events_unconsumed ON events(is_consumed, created_at) WHERE is_consumed = false;

-- 5. audit_log (append-only; DB 层收权在 V2 施加) ---------------
CREATE TABLE audit_log (
    seq            bigint generated always as identity PRIMARY KEY,
    ts             timestamptz NOT NULL DEFAULT now(),
    session_id     uuid,
    actor_type     text        NOT NULL
        CHECK (actor_type IN ('user','agent','sub_agent','system','plugin','mcp','hook')),
    actor_id       text        NOT NULL,
    actor_name     text,
    action         text        NOT NULL,
    action_category text       NOT NULL
        CHECK (action_category IN ('read','write','delete','execute','network','config','auth','system','approval')),
    target_type    text,
    target_id      text,
    target_path    text,
    detail         jsonb,
    args_summary   text,
    result_summary text,
    risk_level     text        CHECK (risk_level IN ('L0','L1','L2','L3')),
    approved       boolean,
    approved_by    text,
    approval_id    text,
    ip_address     text,
    user_agent     text,
    duration_ms    bigint,
    cost_usd       double precision,
    signature      text,
    previous_seq   bigint,
    hash           text
);
CREATE INDEX idx_audit_log_ts      ON audit_log(ts);
CREATE INDEX idx_audit_log_actor   ON audit_log(actor_type, actor_id);
CREATE INDEX idx_audit_log_action  ON audit_log(action);
CREATE INDEX idx_audit_log_target  ON audit_log(target_type, target_id);
CREATE INDEX idx_audit_log_session ON audit_log(session_id, ts);
CREATE INDEX idx_audit_log_risk    ON audit_log(risk_level, ts) WHERE risk_level IN ('L2','L3');

-- 6. model_calls ----------------------------------------------
CREATE TABLE model_calls (
    id                     uuid PRIMARY KEY,
    session_id             uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    loop_step_id           uuid,
    message_id             uuid        REFERENCES messages(id) ON DELETE SET NULL,
    sub_agent_instance     text,
    provider               text        NOT NULL,
    model                  text        NOT NULL,
    endpoint               text,
    request_messages_count integer     NOT NULL,
    request_tokens_est     integer,
    token_in               integer     NOT NULL,
    token_out              integer     NOT NULL,
    cache_read_tokens      integer     DEFAULT 0,
    cache_write_tokens     integer     DEFAULT 0,
    reasoning_tokens       integer     DEFAULT 0,
    cost_input_usd         double precision NOT NULL DEFAULT 0.0,
    cost_output_usd        double precision NOT NULL DEFAULT 0.0,
    cost_cache_read_usd    double precision NOT NULL DEFAULT 0.0,
    cost_cache_write_usd   double precision NOT NULL DEFAULT 0.0,
    cost_total_usd         double precision NOT NULL DEFAULT 0.0,
    duration_ms            bigint      NOT NULL,
    time_to_first_token_ms bigint,
    stream                 boolean     NOT NULL DEFAULT true,
    finish_reason          text,
    status                 text        NOT NULL
        CHECK (status IN ('success','error','fallback','rate_limited','timeout','cancelled')),
    error_code             text,
    error_message          text,
    error_type             text,
    retry_count            integer     NOT NULL DEFAULT 0,
    fallback_from_id       uuid,
    fallback_from_provider text,
    fallback_from_model    text,
    prompt_hash            text,
    tools_count            integer     DEFAULT 0,
    tool_calls_count       integer     DEFAULT 0,
    created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_model_calls_session  ON model_calls(session_id, created_at);
CREATE INDEX idx_model_calls_provider ON model_calls(provider, model);
CREATE INDEX idx_model_calls_created  ON model_calls(created_at);
CREATE INDEX idx_model_calls_status   ON model_calls(status, created_at);
CREATE INDEX idx_model_calls_sub      ON model_calls(sub_agent_instance);

-- 7. configs ---------------------------------------------------
CREATE TABLE configs (
    id             uuid PRIMARY KEY,
    scope          text        NOT NULL CHECK (scope IN ('global','project','profile','session')),
    scope_id       text,
    path           text        NOT NULL,
    value          jsonb       NOT NULL,
    value_type     text        NOT NULL CHECK (value_type IN ('string','number','boolean','object','array','null')),
    schema_version text        NOT NULL DEFAULT '1.0',
    schema_path    text,
    description    text,
    is_secret      boolean     NOT NULL DEFAULT false,
    encrypted_value text,
    is_readonly    boolean     NOT NULL DEFAULT false,
    is_default     boolean     NOT NULL DEFAULT false,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (scope, scope_id, path)
);
CREATE INDEX idx_configs_scope  ON configs(scope, scope_id);
CREATE INDEX idx_configs_path   ON configs(path);
CREATE INDEX idx_configs_secret ON configs(is_secret) WHERE is_secret = true;

-- 8. config_history --------------------------------------------
CREATE TABLE config_history (
    id                 uuid PRIMARY KEY,
    config_id          uuid        NOT NULL REFERENCES configs(id) ON DELETE CASCADE,
    config_path        text        NOT NULL,
    scope              text        NOT NULL,
    scope_id           text,
    old_value          jsonb,
    new_value          jsonb,
    old_schema_version text,
    new_schema_version text,
    changed_by         text        NOT NULL
        CHECK (changed_by IN ('user','system','profile_import','migration','plugin','agent')),
    changed_by_id      text,
    change_reason      text,
    is_rollback        boolean     NOT NULL DEFAULT false,
    rollback_from_id   uuid REFERENCES config_history(id),
    created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_config_history_config ON config_history(config_id, created_at DESC);
CREATE INDEX idx_config_history_path   ON config_history(config_path, created_at DESC);
CREATE INDEX idx_config_history_scope  ON config_history(scope, scope_id, created_at DESC);

-- append-only 硬约束: 收回 UPDATE/DELETE (09 文档 §3.4 append-only 保障)
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
CREATE OR REPLACE FUNCTION audit_log_block_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only';
END;
$$;
CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation();
```

- [ ] **Step 2: Commit**

```bash
git add backend/openwork-storage/src/main/resources/db/migration/V1__init.sql
git commit -m "feat(storage): Flyway V1 基线 — 核心 8 表 PG 化 + audit_log append-only 硬约束"
```

---

### Task 4: Spring Boot 应用装配 + Testcontainers 集成测试

**Files:**
- Create: `backend/openwork-app/src/main/java/com/openwork/app/OpenWorkApplication.java`
- Create: `backend/openwork-app/src/main/resources/application.yml`
- Create: `backend/openwork-app/src/test/java/com/openwork/app/OpenWorkApplicationIT.java`

**Interfaces:**
- Consumes: Task 1 的 Maven 结构、Task 3 的迁移脚本
- Produces: 可执行应用（`java -jar` 或 `mvn spring-boot:run`）；`GET /actuator/health` 返回 UP；后续所有后端任务在该应用内扩展

- [ ] **Step 1: 写失败测试（先于实现）**

`backend/openwork-app/src/test/java/com/openwork/app/OpenWorkApplicationIT.java`：

```java
package com.openwork.app;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OpenWorkApplicationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg17"))
                    .withDatabaseName("openwork")
                    .withUsername("openwork")
                    .withPassword("openwork");

    @Autowired JdbcTemplate jdbc;
    @Autowired TestRestTemplate rest;

    @Test
    void contextLoadsWithVirtualThreadsAndFlywayApplied() {
        // Flyway 已执行基线
        Integer tables = jdbc.queryForObject(
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'", Integer.class);
        assertThat(tables).isGreaterThanOrEqualTo(8);
    }

    @Test
    void coreTablesRoundTrip() {
        UUID projectId = UUID.randomUUID();
        jdbc.update("INSERT INTO projects (id, path, name) VALUES (?,'/tmp/demo','demo')", projectId);
        UUID sessionId = UUID.randomUUID();
        jdbc.update(
            "INSERT INTO sessions (id, project_id) VALUES (?,?)",
            sessionId, projectId);
        String status = jdbc.queryForObject(
            "SELECT s.status FROM sessions s JOIN projects p ON p.id = s.project_id WHERE s.id = ?",
            String.class, sessionId);
        assertThat(status).isEqualTo("active");
    }

    @Test
    void auditLogRejectsUpdate_appendOnlyEnforcedByDb() {
        jdbc.update("INSERT INTO audit_log (actor_type, actor_id, action, action_category) "
                + "VALUES ('system','it','test_action','system')");
        Long seq = jdbc.queryForObject("SELECT max(seq) FROM audit_log", Long.class);
        assertThat(seq).isNotNull();
        // DB 触发器必须拒绝 UPDATE —— append-only 由数据库层保证 (09 文档 §3.4)
        org.junit.jupiter.api.Assertions.assertThrows(
            org.springframework.dao.DataAccessException.class,
            () -> jdbc.update("UPDATE audit_log SET action = 'tampered' WHERE seq = ?", seq));
    }

    @Test
    @SuppressWarnings("unchecked")
    void actuatorHealthIsUp() {
        ResponseEntity<Map> resp = rest.getForEntity("/actuator/health", Map.class);
        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(((Map<String, Object>) resp.getBody()).get("status")).isEqualTo("UP");
    }
}
```

- [ ] **Step 2: 运行验证测试失败**

Run: `cd backend && mvn -pl openwork-app -am test -Dtest=OpenWorkApplicationIT`
Expected: 编译失败 —— `OpenWorkApplication` 不存在。

- [ ] **Step 3: 写最小实现**

`backend/openwork-app/src/main/java/com/openwork/app/OpenWorkApplication.java`：

```java
package com.openwork.app;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.openwork")
@MapperScan("com.openwork.storage.adapter.mybatis")
public class OpenWorkApplication {
    public static void main(String[] args) {
        SpringApplication.run(OpenWorkApplication.class, args);
    }
}
```

`backend/openwork-app/src/main/resources/application.yml`：

```yaml
spring:
  application:
    name: openwork-server
  threads:
    virtual:
      enabled: true          # 09 文档 §3.1
  datasource:
    url: ${OPENWORK_DB_URL:jdbc:postgresql://localhost:5432/openwork}
    username: ${OPENWORK_DB_USER:openwork}
    password: ${OPENWORK_DB_PASSWORD:openwork}
    hikari:
      maximum-pool-size: 20   # 09 文档 §3.9 连接池纪律基线
      connection-timeout: 5000
  flyway:
    enabled: true
    locations: classpath:db/migration

server:
  address: 127.0.0.1          # 仅本地暴露 (09 文档 §3.3)

management:
  endpoints:
    web:
      exposure:
        include: health,info
  endpoint:
    health:
      show-details: when_authorized

logging:
  pattern:
    console: "%d{HH:mm:ss.SSS} %-5level [%thread] %logger{36} - %msg%n"

openwork:
  retrieval:
    vector: pgvector          # pgvector | milvus (条件装配, 后续计划启用)
    keyword: es               # es | pg-fts
  scheduler:
    poll-interval: 30s        # SCHED 域 Poller (v0.4 启用)
```

> 注：`@ServiceConnection` 需要 `spring-boot-testcontainers` 依赖（Task 1 Step 5 已加入）；测试容器复用 `pgvector/pgvector:pg17` 镜像与 compose 一致。若本机 Docker 未启动，测试将失败——这是预期门禁。

- [ ] **Step 4: 运行验证测试通过**

Run: `cd backend && mvn -pl openwork-app -am test -Dtest=OpenWorkApplicationIT`
Expected: 4 个测试全部 PASS（首次运行需拉取镜像，较慢）。

- [ ] **Step 5: Commit**

```bash
git add backend/openwork-app
git commit -m "feat(app): Spring Boot 装配 (虚拟线程/Flyway/HikariCP) + Testcontainers 集成测试"
```

---

### Task 5: ArchUnit 架构守护测试

**Files:**
- Create: `backend/openwork-storage/src/test/java/com/openwork/storage/arch/StorageArchitectureTest.java`
- Create: `backend/openwork-storage/src/test/java/com/openwork/core/domain/archfixture/ViolatingDomainClass.java`（仅测试作用域的违规样本）

**Interfaces:**
- Consumes: Task 1 的模块包结构
- Produces: 可执行的分层守护规则（后续任何违规 PR 会在 `mvn verify` 失败）；规则语义 = 09 文档 §5/§6.2

- [ ] **Step 1: 写违规样本（模拟未来有人把 Mapper 注解带进 domain 层）**

`backend/openwork-storage/src/test/java/com/openwork/core/domain/archfixture/ViolatingDomainClass.java`：

```java
package com.openwork.core.domain.archfixture;

import org.apache.ibatis.annotations.Select;

/** 仅存在于 test classpath 的违规样本: domain 包 import 了 MyBatis 注解 */
public final class ViolatingDomainClass {
    @Select("select 1")
    public interface RogueQuery {
        int one();
    }
    private ViolatingDomainClass() {}
}
```

- [ ] **Step 2: 写架构测试**

`backend/openwork-storage/src/test/java/com/openwork/storage/arch/StorageArchitectureTest.java`：

```java
package com.openwork.storage.arch;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.lang.ArchRule;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.core.importer.ImportOption.Predefined.DO_NOT_INCLUDE_TESTS;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class StorageArchitectureTest {

    private static final String[] MIDDLEWARE_PACKAGES = {
        "org.apache.ibatis..",
        "org.flywaydb..",
        "org.postgresql..",
        "io.milvus..",
        "co.elastic.clients..",
        "dev.langchain4j.store..",
        "com.baomidou.."
    };

    /** 正向: 主代码中 domain 层不得触碰任何中间件客户端或 adapter 实现 (09 §5.1) */
    @Test
    void domainLayerMustStayMiddlewareFree_inMainSources() {
        noClasses()
            .that().resideInAPackage("com.openwork.core.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(MIDDLEWARE_PACKAGES)
            .check(new ClassFileImporter().importPackages(DO_NOT_INCLUDE_TESTS, "com.openwork"));
    }

    /** 反向: 测试夹具中的违规类必须被同一规则捕获 (证明规则真的有效) */
    @Test
    void ruleActuallyCatchesViolation_viaTestFixture() {
        ArchRule rule = noClasses()
            .that().resideInAPackage("com.openwork.core.domain..")
            .should().dependOnClassesThat().resideInAnyPackage("org.apache.ibatis..");
        var violating = new ClassFileImporter()
            .importPackages("com.openwork.core.domain.archfixture");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> rule.check(violating))
            .isInstanceOf(AssertionError.class)
            .hasMessageContaining("ViolatingDomainClass");
    }
}
```

> 说明：正向规则的 `DescribedPredicate<> {}` 占位行会在编译期被下方重新赋值覆盖，实际生效的是第二条赋值；如嫌冗余可删除第一段赋值，只保留最终版本（推荐直接删除）。

- [ ] **Step 3: 运行验证通过**

Run: `cd backend && mvn -pl openwork-storage test`
Expected: 2 个架构测试 PASS（正向规则对当前干净代码库通过；反向证明规则能抓到 ViolatingDomainClass）。

- [ ] **Step 4: Commit**

```bash
git add backend/openwork-storage/src/test
git commit -m "test(storage): ArchUnit 分层守护 — domain 禁触中间件, 含反向有效性验证"
```

---

### Task 6: 归档旧 TS/Electron 栈 + 前端脚手架重建

**Files:**
- Delete: `apps/`、`packages/`、`turbo.json`、`tsconfig.base.json`、`tsconfig.json`、`package.json`、`package-lock.json`
- Create: `frontend/`（Vite React-TS 模板 + antd 冒烟页）
- Modify: `.gitignore`（无需改动，已覆盖 node/dist）

**Interfaces:**
- Produces: `frontend/` 独立 npm 工程，`npm run dev` 起 5173 端口并将 `/api`、`/ws` 代理到 `127.0.0.1:8080`；Task 7 的 frontend-maven-plugin 消费其 `dist/` 产物

> 决策依据（09 文档 §1.1/§2）：Electron IPC Transport 已废弃；旧渲染器深度耦合 `@opencode/transport-ipc`，不做文件级搬运，UI 在后续前端计划中按新 CS 架构重写。git 历史完整保留旧实现可供参照。

- [ ] **Step 1: 移除旧栈**

```bash
git rm -r apps packages turbo.json tsconfig.base.json tsconfig.json package.json package-lock.json
git commit -m "chore: 移除废弃的 TS/Electron 技术栈骨架 (由 Java 后端 + frontend/ 取代, 见 09 文档)"
```

- [ ] **Step 2: 生成 Vite React-TS 前端工程**

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install && npm install antd@^5.22.0
```

- [ ] **Step 3: 配置代理与冒烟页**

替换 `frontend/vite.config.ts`：

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true },
    },
  },
  build: { outDir: 'dist' },
})
```

替换 `frontend/index.html` 中 `<title>` 为 `<title>OpenWork</title>`。

替换 `frontend/src/App.tsx`：

```tsx
import { ConfigProvider } from 'antd'

export default function App() {
  return (
    <ConfigProvider>
      <main style={{ padding: 24 }}>
        <h1>OpenWork</h1>
        <p>Web Client 脚手架就绪 — 后续 UI 计划将在此构建三栏布局。</p>
      </main>
    </ConfigProvider>
  )
}
```

- [ ] **Step 4: 验证构建**

Run: `cd frontend && npm run build`
Expected: `dist/index.html` 生成，无 TypeScript 错误。

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(frontend): Vite+React19+antd 脚手架 (dev proxy 指向 Java 后端 8080)"
```

---

### Task 7: frontend-maven-plugin 打包接线（单 jar 交付）

**Files:**
- Modify: `backend/openwork-app/pom.xml`（build/plugins 增加 frontend-maven-plugin + resources 拷贝）

**Interfaces:**
- Consumes: Task 6 的 `frontend/`（`npm run build` → `dist/`）
- Produces: `mvn -f backend/pom.xml package` 产出含 `static/index.html` 的 fat-jar；浏览器打开 `http://127.0.0.1:8080` 可见前端页面

- [ ] **Step 1: 修改 openwork-app/pom.xml**

在 `<build><plugins>` 中、`spring-boot-maven-plugin` 之前插入：

```xml
            <plugin>
                <groupId>com.github.eirslett</groupId>
                <artifactId>frontend-maven-plugin</artifactId>
                <version>1.15.1</version>
                <configuration>
                    <workingDirectory>${project.basedir}/../../frontend</workingDirectory>
                    <installDirectory>target</installDirectory>
                </configuration>
                <executions>
                    <execution>
                        <id>install-node-and-npm</id>
                        <goals><goal>install-node-and-npm</goal></goals>
                        <configuration>
                            <nodeVersion>v22.14.0</nodeVersion>
                        </configuration>
                        <phase>generate-resources</phase>
                    </execution>
                    <execution>
                        <id>npm-ci</id>
                        <goals><goal>npm</goal></goals>
                        <configuration><arguments>ci</arguments></configuration>
                        <phase>generate-resources</phase>
                    </execution>
                    <execution>
                        <id>npm-build</id>
                        <goals><goal>npm</goal></goals>
                        <configuration><arguments>run build</arguments></configuration>
                        <phase>generate-resources</phase>
                    </execution>
                </executions>
            </plugin>
```

并在 `<build>` 内追加资源拷贝（把前端产物并入 jar）：

```xml
        <resources>
            <resource>
                <directory>src/main/resources</directory>
            </resource>
            <resource>
                <directory>${project.basedir}/../../frontend/dist</directory>
                <targetPath>static</targetPath>
            </resource>
        </resources>
```

- [ ] **Step 2: 打包并端到端冒烟**

```bash
cd backend && mvn -pl openwork-app -am package -DskipTests
java -jar openwork-app/target/openwork-app-0.1.0-SNAPSHOT.jar &
sleep 8
curl -s http://127.0.0.1:8080 | grep -o "<title>[^<]*</title>"
curl -s http://127.0.0.1:8080/actuator/health
kill %1
```

Expected: title 含 `OpenWork`（或 Vite 默认 title）；health 返回 `{"status":"UP"...}`（本机需已起 Task 2 的 PG，否则 health 为 DOWN——冒烟前先 `docker compose -f docker-compose.dev.yml up -d postgres`）。

- [ ] **Step 3: Commit**

```bash
git add backend/openwork-app/pom.xml
git commit -m "build(app): frontend-maven-plugin 接线, 单 jar 内嵌前端静态资源"
```

---

### Task 8: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: push/PR 时自动执行后端 `mvn verify`（含 Testcontainers 集成测试与 ArchUnit）与前端构建

- [ ] **Step 1: 写入 workflow**

```yaml
name: CI

on:
  push:
    branches: [main, "feat/**"]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: "21"
          cache: maven
      - name: Build & Verify (unit + Testcontainers IT + ArchUnit)
        working-directory: backend
        run: mvn -B verify

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - name: Install & Build
        working-directory: frontend
        run: |
          npm ci
          npm run build
```

- [ ] **Step 2: 本地预演关键命令**

Run: `cd backend && mvn -B verify`
Expected: 全模块 BUILD SUCCESS（含 Task 4 集成测试与 Task 5 架构测试——需要本机 Docker）。

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: 后端 mvn verify (Testcontainers/ArchUnit) + 前端构建流水线"
```

---

## 计划边界（不在本计划内）

- 其余 21 张表的迁移脚本 → 随各领域计划增量交付（O11）
- OWASP dependency-check / CycloneDX SBOM 接入 → 供应链专项任务（可与 Plan 2 并行）
- JSON-RPC Dispatcher、SSE/WebSocket Transport、PAOR Loop、工具集、MCP、LangChain4j → Plan 2~5
- 前端真实 UI（三栏布局/编辑器/终端）→ 前端专项计划
