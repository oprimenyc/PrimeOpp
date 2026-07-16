/**
 * Secret-safe logging.
 * Redacts common secret patterns and any key whose name contains "key", "secret",
 * "token", "password", "auth", "credential".
 */
const SECRET_KEY_PATTERNS = /(key|secret|token|password|auth|credential|api[-_]?key)/i;

export interface LogEntry {
  level: "debug" | "info" | "warn" | "error";
  message: string;
  fields?: Record<string, unknown>;
  at: number;
}

export type Logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => void;
  info: (msg: string, fields?: Record<string, unknown>) => void;
  warn: (msg: string, fields?: Record<string, unknown>) => void;
  error: (msg: string, fields?: Record<string, unknown>) => void;
};

export function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (SECRET_KEY_PATTERNS.test(value)) return "[REDACTED]";
    return value;
  }
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERNS.test(k)) out[k] = "[REDACTED]";
      else out[k] = redact(v);
    }
    return out;
  }
  return value;
}

export function createLogger(sink: (e: LogEntry) => void = () => {}): Logger {
  const emit = (level: LogEntry["level"], msg: string, fields?: Record<string, unknown>) => {
    sink({ level, message: msg, fields: redact(fields) as Record<string, unknown> | undefined, at: Date.now() });
  };
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f)
  };
}

export const consoleLogger: Logger = createLogger((e) => {
  const line = `[${new Date(e.at).toISOString()}] ${e.level.toUpperCase()} ${e.message}`;
  if (e.fields && Object.keys(e.fields).length > 0) {
    // eslint-disable-next-line no-console
    console.log(line, JSON.stringify(e.fields));
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
});
