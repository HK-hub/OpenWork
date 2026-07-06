/**
 * OpenCodeClient 单例 — Renderer 进程的统一后端客户端
 *
 * 通过 IpcTransportClient (window.opencode) 与 Main 进程的 BackendServiceHost 通信。
 * 由各 Store / Hook 共享同一个实例,避免重复创建 transport。
 *
 * 对应 04-架构设计文档 v4.2 §5.2 Desktop 客户端架构 — Renderer client 层
 */
import { OpenCodeClient, type TransportClient } from '@opencode/api';
import { IpcTransportClient } from '@opencode/transport-ipc';

let globalClient: OpenCodeClient | null = null;
let globalTransport: TransportClient | null = null;

/** 获取单例 OpenCodeClient (首次调用会创建并 connect) */
export async function getClient(): Promise<OpenCodeClient> {
  if (globalClient) return globalClient;
  const transport = new IpcTransportClient();
  globalTransport = transport;
  globalClient = new OpenCodeClient(transport);
  await globalClient.connect();
  return globalClient;
}

/** 同步获取已创建的 client (未创建则抛错) */
export function getClientSync(): OpenCodeClient {
  if (!globalClient) throw new Error('Client not initialized, call getClient() first');
  return globalClient;
}

/** 销毁 client (一般在 Renderer 卸载时调用,实际 Electron 进程退出即可) */
export async function destroyClient(): Promise<void> {
  if (globalTransport) {
    await globalTransport.disconnect();
  }
  globalClient = null;
  globalTransport = null;
}
