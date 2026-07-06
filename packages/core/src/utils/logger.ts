/**
 * Logger — 基于 winston 的统一日志层
 *
 * 对应 04-架构设计文档 v4.2 §11.7 Logger 日志层
 *      06-详细设计文档 v4.2 §3 后端核心模块
 */
import winston from 'winston';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'verbose';

export interface LoggerOptions {
  level?: LogLevel;
  silent?: boolean;
  filename?: string;
}

const LOG_FORMAT = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, module, ...meta }) => {
    const mod = module ? `[${module}]` : '';
    const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
    return `${timestamp} ${level.toUpperCase().padEnd(7)} ${mod} ${message}${metaStr}`;
  }),
);

let currentLogger: winston.Logger | null = null;

/** 创建/获取全局 logger 实例 */
export function getLogger(opts: LoggerOptions = {}): winston.Logger {
  if (currentLogger && !opts.filename) return currentLogger;

  const transports: winston.transport[] = [
    new winston.transports.Console({
      level: opts.level ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      silent: opts.silent,
      format: winston.format.colorize({ all: false }),
    }),
  ];

  if (opts.filename) {
    transports.push(
      new winston.transports.File({
        filename: opts.filename,
        level: 'debug',
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
    );
  }

  currentLogger = winston.createLogger({
    level: opts.level ?? 'info',
    format: LOG_FORMAT,
    transports,
    exitOnError: false,
  });

  return currentLogger;
}

/** 获取带模块标签的子 logger */
export function moduleLogger(module: string, opts?: LoggerOptions): winston.Logger {
  const base = getLogger(opts);
  return base.child({ module });
}

/** 重新配置 logger (在 Electron Main 启动时切换到 userData 目录) */
export function configureLogger(opts: LoggerOptions): winston.Logger {
  currentLogger = null;
  return getLogger(opts);
}

/** 默认 logger */
export const logger = getLogger();
