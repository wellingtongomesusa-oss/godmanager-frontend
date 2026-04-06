/**
 * Logs Service – godroox
 * Registro centralizado de logs (Stripe, pagamentos, etc.).
 * Em produção: integrar com Datadog, CloudWatch ou BigQuery.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  meta?: Record<string, unknown>;
}

const buffer: LogEntry[] = [];
const MAX_BUFFER = 500;

function emit(level: LogLevel, context: string, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(meta && Object.keys(meta).length > 0 && { meta }),
  };
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) buffer.shift();
  const log = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  log(`[${entry.timestamp}] [${level}] [${context}]`, message, meta ?? '');
}

export const logsService = {
  info(context: string, message: string, meta?: Record<string, unknown>) {
    emit('info', context, message, meta);
  },
  warn(context: string, message: string, meta?: Record<string, unknown>) {
    emit('warn', context, message, meta);
  },
  error(context: string, message: string, meta?: Record<string, unknown>) {
    emit('error', context, message, meta);
  },
  getRecent(limit = 100): LogEntry[] {
    return buffer.slice(-limit).reverse();
  },
};
