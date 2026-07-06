/**
 * Electron Main 进程入口
 *
 * 对应 06-详细设计文档 v4.2 §5.2 Desktop 客户端架构
 *      08-技术选型与架构方案 v3.6 §3.1 Desktop 默认嵌入式模式
 *
 * 职责:
 * 1. 管理 BrowserWindow 生命周期 (创建 / 关闭 / 全部关闭)
 * 2. 启动嵌入式后端 (CoreEngine + BackendServiceHost + IpcTransport)
 * 3. 加载 Renderer (dev: Vite dev server; prod: file://)
 * 4. 应用菜单 (v0.1 简化)
 * 5. 退出时优雅关闭后端
 */
import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  startEmbeddedBackend,
  stopEmbeddedBackend,
  registerWindow,
  unregisterWindow,
} from './backend.js';

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

function resolvePreloadPath(): string {
  // electron-vite 输出 out/preload/index.js
  return join(__dirname, '..', 'preload', 'index.js');
}

function resolveRendererUrl(): string | string {
  if (isDev) {
    // Vite dev server
    return 'http://localhost:5173';
  }
  // 生产环境加载本地 HTML
  return join(__dirname, '..', 'renderer', 'index.html');
}

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false, // 等 ready-to-show 再显示,避免白屏
    autoHideMenuBar: true,
    title: 'OpenCoding Agent',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: resolvePreloadPath(),
      // 安全约束 (06-详细设计文档 §4.9.2)
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // 需要 preload 中 require (electron-vite 推荐)
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  // 外部链接用系统浏览器打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // 注册到 IPC Transport (启动后,后续窗口都会通过此函数加入事件广播)
  registerWindow(win);
  win.on('closed', () => {
    unregisterWindow(win);
    if (win === mainWindow) mainWindow = null;
  });

  // 加载 Renderer
  const url = resolveRendererUrl();
  if (typeof url === 'string' && url.startsWith('http')) {
    await win.loadURL(url);
  } else {
    await win.loadFile(url);
  }

  return win;
}

async function bootstrap(): Promise<void> {
  // v0.1 单窗口:启动时先创建窗口占位,再启动后端并 attach IPC
  // (创建后端时会自动 attach 现有窗口列表)
  mainWindow = await createWindow();

  // 启动嵌入式后端 (传入已创建的窗口)
  try {
    await startEmbeddedBackend([mainWindow]);
    console.log('[main] Embedded backend started');
  } catch (err) {
    console.error('[main] Failed to start embedded backend:', err);
    // 后端启动失败仍允许 UI 显示错误页
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

// 应用就绪
app.whenReady().then(() => {
  bootstrap().catch((err) => {
    console.error('[main] Bootstrap failed:', err);
    app.quit();
  });

  app.on('activate', () => {
    // macOS: 点击 dock 图标时若没有窗口则重建
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap().catch((err) => {
        console.error('[main] Reactivate bootstrap failed:', err);
      });
    }
  });
});

// 所有窗口关闭时退出 (除 macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 优雅退出: 关闭后端
app.on('before-quit', async (event) => {
  event.preventDefault();
  try {
    await stopEmbeddedBackend();
  } catch (err) {
    console.error('[main] Backend stop error:', err);
  }
  // 取消 preventDefault 后真正退出
  app.exit(0);
});

// 防止冷启动时遗漏 fileURLToPath (兼容 CommonJS / ESM)
const __dirname_workaround = typeof __dirname !== 'undefined'
  ? __dirname
  : fileURLToPath(new URL('.', import.meta.url));
void __dirname_workaround;
