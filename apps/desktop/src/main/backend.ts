/**
 * 嵌入式后端启动器 — 在 Electron Main 进程中启动 @opencode/core + @opencode/server
 *
 * 对应 06-详细设计文档 v4.2 §4.9 Electron IPC Transport + §4.10 Embedded Transport
 * 对应 08-技术选型与架构方案 v3.6 §3.1 Desktop 默认嵌入式模式
 *
 * Desktop v0.1 启动模型:
 *  - Main 进程内持有 CoreEngine + BackendServiceHost
 *  - BackendServiceHost 的 transport = IpcTransportServer (暴露给 Renderer)
 *  - Main 进程内部调用可直接经 Router (无需 IPC,见 host.router.invoke)
 *  - Renderer 进程通过 window.opencode (preload 注入) → ipcMain.handle → Router
 *
 * 启动流程:
 * 1. 准备 userData 目录 (数据库 + 日志)
 * 2. 创建 CoreEngine 单例 (openDatabase + migrate + registerBuiltinTools)
 * 3. 创建 IpcTransportServer 并 attach 到 ipcMain + BrowserWindow 列表
 * 4. 创建 BackendServiceHost (router 自动注册所有 handler 并转发到 transport)
 * 5. 启动 transport → 触发 connect 回调
 * 6. EventBus → IPC 推送 (host.registerHandlers 已内置)
 */
import {
  createCore,
  getCore,
  shutdownCore,
  loadConfig,
  type AppConfig,
} from '@opencode/core';
import {
  BackendServiceHost,
  IpcTransportServer,
  type IpcMainHandle,
  type BrowserWindowHandle,
} from '@opencode/server';
import { app, ipcMain, type BrowserWindow } from 'electron';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

let backendHost: BackendServiceHost | null = null;
let ipcTransport: IpcTransportServer | null = null;
const windowHandles = new Map<BrowserWindow, BrowserWindowHandle>();
/** 等待 backend 启动后再注册的窗口 (用于 createWindow 早于 startEmbeddedBackend 的情况) */
const pendingWindows: BrowserWindow[] = [];

/**
 * 启动嵌入式后端 + IPC Transport
 *
 * @param windows 由 main/index.ts 维护的窗口列表,新增窗口会同步到 IPC Transport
 */
export async function startEmbeddedBackend(
  windows: BrowserWindow[],
): Promise<{ host: BackendServiceHost; transport: IpcTransportServer }> {
  if (backendHost && ipcTransport) {
    return { host: backendHost, transport: ipcTransport };
  }

  // 1. 准备 userData 目录
  const dataDir = app.getPath('userData');
  const dbDir = join(dataDir, 'data');
  const logsDir = join(dataDir, 'logs');
  mkdirSync(dbDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });
  const dbPath = join(dbDir, 'opencode.db');

  // 2. 构造配置 (覆盖默认空 dbPath 与日志级别)
  //    注意: DEFAULT_CONFIG 使用 `as const`,导致字面量类型过窄,需用类型断言放宽
  const baseConfig = loadConfig({ userDataDir: dataDir });
  const config = {
    ...baseConfig,
    database: { ...baseConfig.database, path: dbPath },
    logging: {
      ...baseConfig.logging,
      level: (process.env.NODE_ENV === 'development' ? 'debug' : 'info') as AppConfig['logging']['level'],
    },
  } as AppConfig;

  // 3. 创建 CoreEngine (会执行 openDatabase + migrate + registerBuiltinTools)
  await createCore({ userDataDir: dataDir, config });
  const core = getCore();
  if (!core.isStarted()) {
    throw new Error('CoreEngine failed to start');
  }

  // 4. 创建 IpcTransportServer 并 attach 到 ipcMain
  ipcTransport = new IpcTransportServer();
  // 合并启动前已创建的 pending 窗口与本次传入的窗口 (去重)
  const allWindows = [...new Set([...pendingWindows, ...windows])];
  pendingWindows.length = 0;
  const handles = allWindows.map((w) => toHandle(w));
  ipcTransport.attach(ipcMain as unknown as IpcMainHandle, handles);

  // 5. 创建 BackendServiceHost — 自动注册所有 handler 并转发到 IpcTransport
  //    构造函数中 registerHandlers() 会:
  //    a) 把各域 handler 注册到 router
  //    b) 遍历 router.listMethods() 调用 transport.handle(method, ...)
  //    c) 注册 EventBus.onAll → transport.broadcast 推送给 Renderer
  backendHost = new BackendServiceHost({ core, transport: ipcTransport });

  // 6. 启动 transport
  await backendHost.start();

  return { host: backendHost, transport: ipcTransport };
}

function toHandle(w: BrowserWindow): BrowserWindowHandle {
  let h = windowHandles.get(w);
  if (!h) {
    h = { webContents: w.webContents };
    windowHandles.set(w, h);
  }
  return h;
}

/**
 * 通知 IPC Transport 新窗口加入 (支持多窗口事件广播)
 *
 * 在 backend 启动前调用会先入 pending 队列,等 backend 启动时一并 attach。
 */
export function registerWindow(window: BrowserWindow): void {
  if (!ipcTransport) {
    pendingWindows.push(window);
    return;
  }
  ipcTransport.addWindow(toHandle(window));
}

/**
 * 通知 IPC Transport 窗口已关闭
 */
export function unregisterWindow(window: BrowserWindow): void {
  if (!ipcTransport) return;
  const h = windowHandles.get(window);
  if (h) ipcTransport.removeWindow(h);
  windowHandles.delete(window);
}

/**
 * 关闭后端 (在 app.before-quit 中调用)
 */
export async function stopEmbeddedBackend(): Promise<void> {
  if (backendHost) {
    await backendHost.stop();
    backendHost = null;
  }
  ipcTransport = null;
  windowHandles.clear();
  await shutdownCore();
}
