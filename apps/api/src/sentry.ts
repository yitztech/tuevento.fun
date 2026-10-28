// Registro de errores en Bugsink de la plataforma (AUDITORIA INT-07). Se importa antes que nada
// en main.ts. Apagado sin SENTRY_DSN (en local y en el CI); sin datos personales ni trazas.
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (dsn)
  Sentry.init({
    dsn,
    release: process.env.RELEASE_SHA,
    environment: process.env.SENTRY_ENVIRONMENT || "production",
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
  });

/** Los 5xx y los errores no controlados; los 4xx esperados no se envían. */
export function reportError(error: unknown, requestId?: string) {
  if (!dsn) return;
  Sentry.withScope((scope) => {
    if (requestId) scope.setTag("requestId", requestId);
    Sentry.captureException(error);
  });
}
