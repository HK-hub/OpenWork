/**
 * EventBus — 后端事件总线
 *
 * 同进程事件分发,后端模块通过 emit() 发布事件,
 * Transport 层通过 subscribe() 转发给前端。
 *
 * 对应 04-架构设计文档 v4.2 §12.3 EventBus 实现
 *      06-详细设计文档 v4.2 §3 模块详细设计
 */
import type { AppEvent, EventType } from '@opencode/api';
import { genRawId } from '../utils/id-generator.js';
import { moduleLogger } from '../utils/logger.js';
import type { EventListener, EventSubscriptionHandle, WildcardListener } from './event-types.js';

const log = moduleLogger('EventBus');

export class EventBus {
  private typedListeners = new Map<EventType, Set<EventListener>>();
  private wildcardListeners = new Set<WildcardListener>();
  private middleware: Array<(event: AppEvent, next: () => void) => void> = [];

  /** 注册事件监听器 */
  on<T extends EventType>(type: T, listener: EventListener<Extract<AppEvent, { type: T }>>): EventSubscriptionHandle {
    let set = this.typedListeners.get(type);
    if (!set) {
      set = new Set();
      this.typedListeners.set(type, set);
    }
    set.add(listener as EventListener);
    log.debug('listener registered', { type, count: set.size });
    return {
      id: genRawId(8),
      type,
      unsubscribe: () => {
        set?.delete(listener as EventListener);
        log.debug('listener removed', { type, count: set?.size ?? 0 });
      },
    };
  }

  /** 注册通配符监听器 (接收所有事件) */
  onAll(listener: WildcardListener): EventSubscriptionHandle {
    this.wildcardListeners.add(listener);
    return {
      id: genRawId(8),
      type: '*',
      unsubscribe: () => {
        this.wildcardListeners.delete(listener);
      },
    };
  }

  /** 一次性监听 */
  once<T extends EventType>(type: T, listener: EventListener<Extract<AppEvent, { type: T }>>): EventSubscriptionHandle {
    const handle = this.on(type, (event) => {
      handle.unsubscribe();
      return (listener as EventListener)(event);
    });
    return handle;
  }

  /** 发布事件 (同步分发,异步监听器会被 await 但不阻塞调用方) */
  emit(event: AppEvent): void {
    // middleware 链
    const run = (idx: number) => {
      if (idx >= this.middleware.length) {
        this.dispatch(event);
        return;
      }
      this.middleware[idx]!(event, () => run(idx + 1));
    };
    run(0);
  }

  /** 添加中间件 (日志 / 持久化 / 过滤) */
  use(middleware: (event: AppEvent, next: () => void) => void): void {
    this.middleware.push(middleware);
  }

  /** 清空所有监听器 (用于测试 / 后端关闭) */
  clear(): void {
    this.typedListeners.clear();
    this.wildcardListeners.clear();
    this.middleware.length = 0;
  }

  /** 获取某类型监听器数量 */
  listenerCount(type: EventType): number {
    return (this.typedListeners.get(type)?.size ?? 0) + this.wildcardListeners.size;
  }

  private dispatch(event: AppEvent): void {
    const type = event.type;
    const typed = this.typedListeners.get(type);
    const errors: unknown[] = [];

    const safeCall = async (listener: EventListener | WildcardListener, isWildcard: boolean) => {
      try {
        await (isWildcard
          ? (listener as WildcardListener)(type, event)
          : (listener as EventListener)(event));
      } catch (err) {
        errors.push(err);
        log.error('listener error', { type, error: (err as Error).message });
      }
    };

    // 同步遍历 + 异步执行
    if (typed) {
      for (const listener of typed) {
        void safeCall(listener, false);
      }
    }
    for (const listener of this.wildcardListeners) {
      void safeCall(listener, true);
    }
  }
}

/** 默认全局 EventBus 实例 (单进程内单例) */
let globalBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalBus) {
    globalBus = new EventBus();
    log.info('global EventBus created');
  }
  return globalBus;
}

/** 重置全局 EventBus (用于测试) */
export function resetEventBus(): void {
  globalBus?.clear();
  globalBus = null;
}
