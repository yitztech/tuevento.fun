import type { LoggerService } from "@nestjs/common";
import type { FastifyBaseLogger, FastifyServerOptions } from "fastify";

/**
 * Logs en JSON a stdout, una línea por evento (AGENTS.md §30): `time` en RFC 3339 y UTC, `level`
 * con su nombre y `msg`. Sin `debug` en producción.
 */
export const loggerOptions: FastifyServerOptions["logger"] = {
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  base: undefined,
  messageKey: "msg",
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  formatters: { level: (label: string) => ({ level: label }) },
};

/** Los mensajes de Nest (arranque, errores de los servicios) salen por el mismo logger JSON. */
export class JsonLogger implements LoggerService {
  constructor(private pino: FastifyBaseLogger) {}
  private write(level: "info" | "warn" | "error" | "debug" | "trace", message: unknown, params: unknown[]) {
    const context = typeof params[params.length - 1] === "string" ? params.pop() : undefined;
    const stack = level === "error" && typeof params[0] === "string" ? params[0] : undefined;
    this.pino[level]({ context, ...(stack ? { stack } : {}) }, String(message));
  }
  log(message: unknown, ...params: unknown[]) {
    this.write("info", message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.write("error", message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.write("warn", message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.write("debug", message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.write("trace", message, params);
  }
}
