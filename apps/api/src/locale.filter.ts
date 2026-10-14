import {
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
  Logger,
} from "@nestjs/common";
import type { FastifyRequest, FastifyReply } from "fastify";
import { normalizeLocale, translateMessage } from "@tuevento/contracts";
@Catch()
export class LocaleExceptionFilter implements ExceptionFilter {
  private logger = new Logger(LocaleExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp(),
      request = context.getRequest<FastifyRequest>(),
      reply = context.getResponse<FastifyReply>();
    const locale = normalizeLocale(request.headers["accept-language"]);
    const statusCode = (exception as { statusCode?: unknown })?.statusCode;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : typeof statusCode === "number"
          ? statusCode
          : 500;
    if (status === 500)
      this.logger.error(
        exception instanceof Error ? exception.message : "Unexpected error",
      );
    const response =
      exception instanceof HttpException
        ? exception.getResponse()
        : status === 429
          ? {
              message:
                "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
            }
          : status !== 500 && exception instanceof Error
            ? { message: exception.message }
            : { message: "Error interno. Inténtalo de nuevo." };
    const translate = (value: unknown): unknown =>
      typeof value === "string"
        ? translateMessage(value, locale)
        : Array.isArray(value)
          ? value.map(translate)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value).map(([key, item]) => [
                  key,
                  translate(item),
                ]),
              )
            : value;
    reply
      .header("Content-Language", locale)
      .status(status)
      .send({
        statusCode: status,
        ...(typeof response === "string"
          ? { message: translate(response) }
          : (translate(response) as object)),
      });
  }
}
