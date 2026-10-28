import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { ProblemException, sendProblem, type ProblemInput } from "./problem";
import { reportError } from "./sentry";

/** Todo error sale en Problem Details y en el idioma de la petición (AGENTS.md §22). */
@Catch()
export class LocaleExceptionFilter implements ExceptionFilter {
  private logger = new Logger(LocaleExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp(),
      request = context.getRequest<FastifyRequest>(),
      reply = context.getResponse<FastifyReply>();
    return sendProblem(request, reply, toProblem(exception, this.logger, request));
  }
}

/** Convierte cualquier excepción en un problema; los 500 se registran sin salir en la respuesta. */
export function toProblem(exception: unknown, logger: Logger, request: FastifyRequest): ProblemInput {
  if (exception instanceof ProblemException) {
    if (exception.problem.status >= 500) reportError(exception, request.id);
    return exception.problem;
  }
  if (exception instanceof HttpException) {
    if (exception.getStatus() >= 500) reportError(exception, request.id);
    const response = exception.getResponse();
    const message = typeof response === "string" ? response : (response as { message?: unknown }).message;
    // Los mensajes por defecto de Nest («Not Found»…) no son claves: queda el título del estado
    return {
      status: exception.getStatus(),
      detail: typeof message === "string" && /^[a-z]+\.[A-Za-z0-9.]+$/.test(message) ? message : undefined,
    };
  }
  // Errores de Fastify (cuerpo demasiado grande, JSON mal formado…) traen su estado
  const statusCode = (exception as { statusCode?: unknown })?.statusCode;
  if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500)
    return { status: statusCode, detail: statusCode === 429 ? "errors.tooManyAttemptsPlease" : undefined };
  logger.error(
    `${exception instanceof Error ? exception.message : "Unexpected error"} (requestId ${request.id})`,
    exception instanceof Error ? exception.stack : undefined,
  );
  reportError(exception, request.id);
  return { status: 500, detail: "errors.internalErrorPleaseTry" };
}
