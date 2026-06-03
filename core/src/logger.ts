/**
 * Minimal leveled logger that writes to stderr only.
 *
 * stdout is reserved for the CLI's machine-readable JSON result and for the
 * MCP stdio transport, so all diagnostics MUST go to stderr to avoid corrupting
 * either channel.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 99,
};

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

export function createLogger(scope: string, level: LogLevel = "info"): Logger {
  const threshold = ORDER[level] ?? ORDER.info;

  function emit(lvl: Exclude<LogLevel, "silent">, msg: string, meta?: unknown) {
    if (ORDER[lvl] < threshold) return;
    const line = `[charkathat:${scope}] ${lvl.toUpperCase()} ${msg}`;
    if (meta !== undefined) {
      process.stderr.write(`${line} ${safeJson(meta)}\n`);
    } else {
      process.stderr.write(`${line}\n`);
    }
  }

  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
  };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Normalise any thrown value into a readable message. */
export function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return safeJson(error);
}
