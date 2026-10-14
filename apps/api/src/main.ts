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
import { normalizeLocale, translateMessage } from "@tuevento/contracts";
async function bootstrap() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Solo el contenedor de Nginx (IP privada) puede hablar con la API, y Nginx
    // sobrescribe X-Forwarded-For con la IP real del cliente. Por eso se confía en
    // saltos privados y el cliente nunca es un salto de confianza: así el rate limit
    // y las métricas usan la IP real, tanto en desarrollo como tras el HTTPS externo.
    new FastifyAdapter({
      bodyLimit: 3 * 1024 * 1024,
      trustProxy: (address: string) => isPrivateAddress(address),
    }),
  );
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new LocaleExceptionFilter());
  await app.register(cookie);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, {
    max: 240,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
  });
  const origins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:5187,http://127.0.0.1:5187"
  ).split(",");
  app.enableCors({
    origin: origins,
    credentials: true,
    allowedHeaders: ["Content-Type", "X-TuEvento-Client", "Accept-Language", "X-Client-Platform", "X-App-Version", "Authorization"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("onRequest", async (req: any, reply: any) => {
      if (req.url.startsWith("/api")) {
        reply.header("Cache-Control", "no-store");
        reply.header(
          "Content-Language",
          normalizeLocale(req.headers["accept-language"]),
        );
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
                normalizeLocale(req.headers["accept-language"]),
              ),
            });
      }
    });
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT || 3087), "0.0.0.0");
}
// Redes privadas y loopback: Docker, el host y el propio Nginx. Una IP pública nunca
// se trata como proxy, así que no puede falsificar la IP del cliente.
function isPrivateAddress(address: string): boolean {
  const ip = address.replace(/^::ffff:/i, "");
  return (
    /^127\./.test(ip) ||
    /^10\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^::1$/.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip)
  );
}
bootstrap().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
