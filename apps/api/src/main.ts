import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AppModule } from "./app.module";
import { LocaleExceptionFilter } from "./locale.filter";
import { JsonLogger, loggerOptions } from "./logger";
import { sendProblem } from "./problem";
import { requestLocale } from "./request-locale";
import { assertAppSecret } from "./tokens";
import { assertPaymentsConfig } from "./payment-config";
import { isTrustedProxy, startTrustedProxyRefresh } from "./trusted-proxy";

/** Cuerpo JSON de 1 MB como máximo (§23); las subidas de imágenes declaran el suyo. */
const BODY_LIMIT = 1024 * 1024;
const UPLOAD_BODY_LIMIT = 3 * 1024 * 1024;
const uploadRoutes = new Set(["/api/profile/avatar", "/api/events/:id/postcard/images", "/api/provider/images"]);
/**
 * Baja en un clic desde el gestor de correo (RFC 8058): llega como formulario, sin la cabecera
 * propia ni Origin. Es segura sin ellos: solo da de baja la dirección del enlace firmado.
 */
const ONE_CLICK_UNSUBSCRIBE = "/api/mail/unsubscribe";
/** Webhook de Stripe: llega de su servidor, sin Origin ni cabecera propia; lo protege su firma. */
const PAYMENT_WEBHOOK = "/api/payments/webhook";
/** `X-Request-ID` del cliente o del gateway si es razonable; si no, uno nuevo. */
const requestIdPattern = /^[A-Za-z0-9._-]{8,128}$/;

async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  assertAppSecret();
  assertPaymentsConfig();
  await startTrustedProxyRefresh();
  const adapter = new FastifyAdapter({
    bodyLimit: UPLOAD_BODY_LIMIT,
    // Solo se confía en el gateway de la red interna del compose, que fija
    // X-Forwarded-For con la IP real del cliente (ver trusted-proxy.ts).
    trustProxy: (address: string) => isTrustedProxy(address),
    logger: loggerOptions,
    // Cada petición se registra una vez, al responder (hook onResponse)
    disableRequestLogging: true,
    requestIdHeader: false,
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
      const header = req.headers["x-request-id"];
      return typeof header === "string" && requestIdPattern.test(header) ? header : randomUUID();
    },
  });
  const fastify = adapter.getInstance();
  // Nest registra las rutas al arrancar: este hook fija el límite de cuerpo de cada una
  fastify.addHook("onRoute", (route) => {
    route.bodyLimit = uploadRoutes.has(route.url) ? UPLOAD_BODY_LIMIT : BODY_LIMIT;
  });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: new JsonLogger(fastify.log),
    // El webhook de Stripe se firma sobre el cuerpo exacto (req.rawBody)
    rawBody: true,
  });
  app.setGlobalPrefix("api");
  // También pasan por aquí los errores de Fastify (cuerpo demasiado grande, JSON mal formado,
  // límite global de peticiones) y las rutas inexistentes: Nest los envía a los filtros globales
  app.useGlobalFilters(new LocaleExceptionFilter());
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: Number(
      process.env.RATE_LIMIT_MAX ||
        (process.env.DEMO_ENABLED === "true" ? 1200 : 300),
    ),
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
    // El estado de las páginas de proveedores lo pide el nginx de `web` (una sola IP) por
    // cada visita; el gateway no deja llegar /api/internal/ desde fuera
    allowList: (req) => req.url.startsWith("/api/internal/"),
  });
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:5187,http://127.0.0.1:5187"
  ).split(",");
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-TuEvento-Client", "X-Client-Platform", "X-App-Version", "X-App-Locale", "X-Request-ID", "Authorization"],
    exposedHeaders: ["X-Request-ID", "Retry-After"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  fastify.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    reply.header("X-Request-ID", req.id);
    if (req.url.startsWith("/api")) {
      reply.header("Cache-Control", "no-store");
      reply.header("Content-Language", requestLocale(req));
    }
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && ![ONE_CLICK_UNSUBSCRIBE, PAYMENT_WEBHOOK].includes(req.url.split("?")[0])) {
      if (
        req.headers["x-tuevento-client"] !== "1" ||
        (req.headers.origin && !origins.includes(req.headers.origin))
      )
        return sendProblem(req, reply, {
          status: 403,
          code: "origin_not_allowed",
          detail: "errors.requestOriginNotAllowed",
        });
    }
  });
  // Una línea por petición (§30). La ruta va como patrón (/api/invitations/:token): así los
  // tokens de los enlaces no llegan al log.
  fastify.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/api/health") return;
    req.log.info({
      msg: "request",
      requestId: req.id,
      method: req.method,
      path: req.routeOptions.url ?? "(sin ruta)",
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3087), "0.0.0.0");
}
bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
