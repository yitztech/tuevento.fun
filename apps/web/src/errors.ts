// Errores del navegador a Bugsink de la plataforma (AUDITORIA INT-07). La DSN se incrusta al
// compilar desde la variable SENTRY_DSN del repositorio; sin ella (local, CI, apps nativas) no
// se carga nada.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;
if (dsn)
  Sentry.init({
    dsn,
    release: import.meta.env.VITE_RELEASE_SHA,
    environment: "production",
    // Sin datos personales: ni usuario, ni cookies, cabeceras, cuerpos, query o variables locales
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
  });
