/**
 * 后端事件总线 — Event Types
 *
 * 对应 04-架构设计文档 v4.2 §12 Event Bus 与事件系统
 *      06-详细设计文档 v4.2 §3.0 模块映射表
 *
 * 后端 EventBus 用于内部模块解耦 + 跨 Transport 事件推送 (notify)。
 */
import type { AppEvent, EventType } from '@opencode/api';

/** 事件监听器 */
export type EventListener<E extends AppEvent = AppEvent> = (event: E) => void | Promise<void>;

/** 通配符监听器 (接收所有事件) */
export type WildcardListener = (type: EventType, event: AppEvent) => void | Promise<void>;

/** 事件订阅句柄 (用于取消订阅) */
export interface EventSubscriptionHandle {
  readonly id: string;
  readonly type: EventType | '*';
  unsubscribe(): void;
}
