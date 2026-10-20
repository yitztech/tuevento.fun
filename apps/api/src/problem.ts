import { HttpException, HttpStatus } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  problemErrors,
  problemStatus,
  translate,
  translateMessage,
  validationOptions,
  type Problem,
  type ProblemFieldError,
} from "@tuevento/contracts";
import type { z } from "zod";
import { requestLocale } from "./request-locale";

/** Datos de un error antes de traducirlo: `detail` y los `message` son claves del catálogo. */
export type ProblemInput = {
  status: number;
  code?: string;
  detail?: string;
  errors?: ProblemFieldError[];
  retryAfter?: number;
};

/** Error con código propio, campos y, en los 429, los segundos de `Retry-After`. */
export class ProblemException extends HttpException {
  constructor(readonly problem: ProblemInput) {
    super(problem.detail ?? problemStatus(problem.status).title, problem.status);
  }
}

/** 429 con `Retry-After` (AGENTS.md §21 y §24). */
export const tooManyRequests = (retryAfter: number) =>
  new ProblemException({
    status: HttpStatus.TOO_MANY_REQUESTS,
    detail: "errors.tooManyAttemptsPlease",
    retryAfter,
  });

/**
 * Valida con zod. Un cuerpo que no pasa responde 422 con un error por campo; un parámetro de la
 * ruta o de la consulta con formato inválido, 400 (§21).
 */
export function parse<T extends z.ZodType>(
  schema: T,
  value: unknown,
  req?: FastifyRequest,
  status: 400 | 422 = 422,
): z.output<T> {
  const result = schema.safeParse(value, validationOptions(requestLocale(req)));
  if (result.success) return result.data;
  const errors = problemErrors(result.error);
  throw new ProblemException({
    status,
    detail: errors[0]?.message || "errors.checkDetails",
    errors,
  });
}

/**
 * Responde en Problem Details (RFC 9457). Conserva además `statusCode`, `message` y `fields`, que
 * leen las versiones publicadas de la app, hasta la siguiente versión mayor de la API (§22).
 */
export function sendProblem(req: FastifyRequest, reply: FastifyReply, input: ProblemInput) {
  const locale = requestLocale(req);
  const meta = problemStatus(input.status);
  const detail = translateMessage(input.detail ?? meta.title, locale);
  const errors = input.errors?.map((e) => ({ ...e, message: translateMessage(e.message, locale) }));
  const body: Problem & { statusCode: number; message: string; fields?: Record<string, string[]> } = {
    type: "about:blank",
    title: translate(locale, meta.title),
    status: input.status,
    code: input.code ?? meta.code,
    detail,
    requestId: req.id,
    ...(errors?.length ? { errors } : {}),
    statusCode: input.status,
    message: detail,
    ...(errors?.length ? { fields: legacyFields(errors) } : {}),
  };
  if (input.retryAfter) reply.header("Retry-After", String(Math.max(1, Math.ceil(input.retryAfter))));
  return reply
    .header("Content-Language", locale)
    .type(problemContentType(req))
    .status(input.status)
    .send(body);
}

/**
 * Las apps publicadas (CapacitorHttp) solo interpretan como JSON `application/json`: siguen
 * recibiéndolo hasta que dejen de usarse; la web y los demás clientes reciben `application/problem+json`.
 */
function problemContentType(req: FastifyRequest) {
  const platform = req.headers["x-client-platform"];
  return platform === "android" || platform === "ios"
    ? "application/json; charset=utf-8"
    : "application/problem+json; charset=utf-8";
}

function legacyFields(errors: ProblemFieldError[]) {
  const fields: Record<string, string[]> = {};
  for (const e of errors) {
    const field = e.field.split(".")[0] || "_";
    fields[field] = [...(fields[field] ?? []), e.message];
  }
  return fields;
}
