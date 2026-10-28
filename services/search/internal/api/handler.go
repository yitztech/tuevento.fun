// Package api atiende /api/search/* (AGENTS.md §21–§23 y §30).
package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/yitztech/tuevento.fun/services/search/internal/store"
)

// Searcher es lo que el handler necesita del store (así se prueba sin base de datos).
type Searcher interface {
	Search(ctx context.Context, q store.Query) ([]store.Card, *store.Cursor, map[string]int, error)
}

// Config del servidor.
type Config struct {
	Origins Origins
	// Orígenes que pueden leer la búsqueda desde otro dominio (las apps Capacitor), sin cookies
	AllowedOrigins []string
	RateLimit      int
	RateWindow     time.Duration
	Log            *slog.Logger
	SearchStore    Searcher
}

type ctxKey int

const (
	keyRequestID ctxKey = iota
	keyLocale
)

var origins Origins
var requestIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{8,128}$`)

func requestID(r *http.Request) string {
	id, _ := r.Context().Value(keyRequestID).(string)
	return id
}

func requestLocale(r *http.Request) string {
	if locale, ok := r.Context().Value(keyLocale).(string); ok {
		return locale
	}
	platform := r.Header.Get("X-Client-Platform")
	return LocaleForRequest(r.Host, r.Header.Get("X-App-Locale"), platform == "android" || platform == "ios", origins)
}

// clientIP: la que fija el gateway en X-Real-IP (el único que llega a este servicio).
func clientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); net.ParseIP(ip) != nil {
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

type recorder struct {
	http.ResponseWriter
	status int
}

func (r *recorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

// New devuelve el handler con sus rutas, el requestId, el idioma, el límite por IP y el log.
func New(cfg Config) http.Handler {
	origins = cfg.Origins
	limit := newLimiter(cfg.RateLimit, cfg.RateWindow)
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("GET /api/search/providers", func(w http.ResponseWriter, r *http.Request) {
		if ok, retry := limit.allow(clientIP(r), time.Now()); !ok {
			w.Header().Set("Retry-After", strconv.Itoa(retry))
			writeProblem(w, r, http.StatusTooManyRequests, "errors.tooManyAttemptsPlease", nil)
			return
		}
		q, errs := ParseQuery(r.URL.Query(), requestLocale(r))
		if len(errs) > 0 {
			writeProblem(w, r, http.StatusBadRequest, "problems.badRequest", errs)
			return
		}
		items, next, facets, err := cfg.SearchStore.Search(r.Context(), q)
		if err != nil {
			cfg.Log.Error("búsqueda fallida", "requestId", requestID(r), "error", err.Error())
			writeProblem(w, r, http.StatusServiceUnavailable, "search.unavailable", nil)
			return
		}
		var cursor *string
		if next != nil {
			c := EncodeCursor(*next, q.Sort)
			cursor = &c
		}
		if items == nil {
			items = []store.Card{}
		}
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Content-Language", requestLocale(r))
		// Solo datos públicos de perfiles publicados
		w.Header().Set("Cache-Control", "public, max-age=60")
		w.Header().Add("Vary", "Host, X-App-Locale")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"items": items, "nextCursor": cursor, "facets": map[string]any{"categories": facets},
		})
	})
	// Preflight de las apps: X-App-Locale no es una cabecera simple
	mux.HandleFunc("OPTIONS /api/search/providers", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Access-Control-Allow-Methods", "GET")
		w.Header().Set("Access-Control-Allow-Headers", "X-App-Locale, X-Request-ID")
		w.Header().Set("Access-Control-Max-Age", "600")
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// La búsqueda solo se lee: otro método en su ruta es 405, no 404
		if r.URL.Path == "/api/search/providers" {
			w.Header().Set("Allow", "GET, OPTIONS")
			writeProblem(w, r, http.StatusMethodNotAllowed, "problems.badRequest", nil)
			return
		}
		writeProblem(w, r, http.StatusNotFound, "problems.notFound", nil)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		id := r.Header.Get("X-Request-ID")
		if !requestIDPattern.MatchString(id) {
			b := make([]byte, 16)
			_, _ = rand.Read(b)
			id = hex.EncodeToString(b)
		}
		h := w.Header()
		h.Set("X-Request-ID", id)
		// Las mismas cabeceras de seguridad que la API (helmet)
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "SAMEORIGIN")
		h.Set("Referrer-Policy", "no-referrer")
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cross-Origin-Resource-Policy", "same-origin")
		h.Set("X-Permitted-Cross-Domain-Policies", "none")
		if origin := r.Header.Get("Origin"); origin != "" && slices.Contains(cfg.AllowedOrigins, origin) {
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Expose-Headers", "X-Request-ID, Retry-After")
			h.Add("Vary", "Origin")
		}
		ctx := context.WithValue(r.Context(), keyRequestID, id)
		r = r.WithContext(ctx)
		r = r.WithContext(context.WithValue(ctx, keyLocale, requestLocale(r)))
		rec := &recorder{ResponseWriter: w, status: http.StatusOK}
		mux.ServeHTTP(rec, r)
		if r.URL.Path == "/healthz" {
			return
		}
		// Una línea por petición (§30), sin la query: lleva lo que la persona escribió
		cfg.Log.Info("request", "requestId", id, "method", r.Method, "path", r.URL.Path,
			"status", rec.status, "durationMs", time.Since(start).Milliseconds())
	})
}
