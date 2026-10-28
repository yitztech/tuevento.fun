// Servicio de búsqueda de proveedores: GET /api/search/providers sobre provider_search, con el
// rol de solo lectura search_ro (docs/PLAN-PROVEEDORES-Y-OFFLINE.md, fase 5).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/yitztech/tuevento.fun/services/search/internal/api"
	"github.com/yitztech/tuevento.fun/services/search/internal/catalog"
	"github.com/yitztech/tuevento.fun/services/search/internal/store"
)

func main() {
	// Healthcheck de Docker sin wget ni shell en la imagen: el mismo binario pide /healthz
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		resp, err := http.Get("http://127.0.0.1:" + port() + "/healthz")
		if err != nil || resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		os.Exit(0)
	}
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				a.Value = slog.StringValue(a.Value.Time().UTC().Format(time.RFC3339))
			}
			return a
		},
	}))
	report, flush := errorReporter(log)
	defer flush()
	if err := run(log, report); err != nil {
		flush()
		log.Error("el servicio no arranca", "error", err.Error())
		os.Exit(1)
	}
}

// errorReporter activa el registro de errores en Bugsink de la plataforma (AUDITORIA INT-07) si
// hay SENTRY_DSN: solo el error y su requestId, sin datos de la petición ni trazas.
func errorReporter(log *slog.Logger) (func(error, string), func()) {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		return nil, func() {}
	}
	environment := os.Getenv("SENTRY_ENVIRONMENT")
	if environment == "" {
		environment = "production"
	}
	if err := sentry.Init(sentry.ClientOptions{Dsn: dsn, Release: os.Getenv("RELEASE_SHA"), Environment: environment}); err != nil {
		log.Warn("Bugsink no disponible", "error", err.Error())
		return nil, func() {}
	}
	report := func(err error, requestID string) {
		sentry.WithScope(func(scope *sentry.Scope) {
			scope.SetTag("requestId", requestID)
			sentry.CaptureException(err)
		})
	}
	return report, func() { sentry.Flush(2 * time.Second) }
}

func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "3089"
}

// origins lee SITE_URL_<IDIOMA> (y SITE_URL para el principal) de los idiomas con dominio propio.
func origins() (api.Origins, error) {
	found := api.Origins{}
	for _, l := range catalog.Data.Locales {
		if l.HostedBy != nil {
			continue
		}
		value := os.Getenv("SITE_URL_" + strings.ToUpper(l.Code))
		if value == "" && l.Code == catalog.Data.DefaultLocale {
			value = os.Getenv("SITE_URL")
		}
		if value == "" {
			continue
		}
		u, err := url.Parse(value)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
			return nil, fmt.Errorf("SITE_URL_%s no es un origen http(s): %q", strings.ToUpper(l.Code), value)
		}
		found[l.Code] = u.Scheme + "://" + u.Host
	}
	if _, ok := found[catalog.Data.DefaultLocale]; !ok {
		return nil, errors.New("falta SITE_URL_" + strings.ToUpper(catalog.Data.DefaultLocale))
	}
	return found, nil
}

// allowedOrigins lee ALLOWED_ORIGINS (separados por comas), la misma variable que la API.
func allowedOrigins() []string {
	var out []string
	for _, o := range strings.Split(os.Getenv("ALLOWED_ORIGINS"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			out = append(out, o)
		}
	}
	return out
}

func run(log *slog.Logger, report func(error, string)) error {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return errors.New("falta DATABASE_URL")
	}
	sites, err := origins()
	if err != nil {
		return err
	}
	// Peticiones por IP cada 10 s; las pruebas, que salen todas de la misma IP, lo suben
	rateLimit := 30
	if raw := os.Getenv("SEARCH_RATE_LIMIT"); raw != "" {
		if rateLimit, err = strconv.Atoi(raw); err != nil || rateLimit < 1 {
			return fmt.Errorf("SEARCH_RATE_LIMIT no es un entero positivo: %q", raw)
		}
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return fmt.Errorf("DATABASE_URL no es válida: %w", err)
	}
	// Pool pequeño y consultas acotadas (§26); la contraseña llega en PGPASSWORD
	config.MaxConns = 4
	config.ConnConfig.RuntimeParams["statement_timeout"] = "2000"
	config.ConnConfig.RuntimeParams["application_name"] = "search"
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return err
	}
	defer pool.Close()
	server := &http.Server{
		Addr: ":" + port(),
		Handler: api.New(api.Config{
			Origins: sites, AllowedOrigins: allowedOrigins(), RateLimit: rateLimit, RateWindow: 10 * time.Second, Log: log, SearchStore: store.New(pool), Report: report,
		}),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	errc := make(chan error, 1)
	go func() { errc <- server.ListenAndServe() }()
	log.Info("search escuchando", "port", port())
	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	// SIGTERM: deja de aceptar y termina lo que está en curso antes de 8 s (Docker espera 10)
	shutdown, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return server.Shutdown(shutdown)
}
