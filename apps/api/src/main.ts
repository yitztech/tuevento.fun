import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { AppModule } from "./app.module";
import { LocaleExceptionFilter } from "./locale.filter";
import { translateMessage } from "@tuevento/contracts";
import { requestLocale } from "./request-locale";
import { isTrustedProxy, startTrustedProxyRefresh } from "./trusted-proxy";
async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  await startTrustedProxyRefresh();
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Solo se confía en el gateway de la red interna del compose, que fija
    // X-Forwarded-For con la IP real del cliente (ver trusted-proxy.ts).
    new FastifyAdapter({
      bodyLimit: 3 * 1024 * 1024,
      trustProxy: (address: string) => isTrustedProxy(address),
    }),
  );
  app.setGlobalPrefix("api");
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
  });
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:5187,http://127.0.0.1:5187"
  ).split(",");
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-TuEvento-Client", "X-Client-Platform", "X-App-Version", "X-App-Locale", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", async (req: any, reply: any) => {
      if (req.url.startsWith("/api")) {
        reply.header("Cache-Control", "no-store");
        reply.header("Content-Language", requestLocale(req));
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (
          req.headers["x-tuevento-client"] !== "1" ||
          (req.headers.origin && !origins.includes(req.headers.origin))
        )
          return reply
            .code(403)
            .send({
              message: translateMessage(
                "Origen de solicitud no permitido.",
                requestLocale(req),
              ),
            });
      }
    });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3087), "0.0.0.0");
}
bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
