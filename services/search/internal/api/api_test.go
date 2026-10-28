package api

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/yitztech/tuevento.fun/services/search/internal/catalog"
	"github.com/yitztech/tuevento.fun/services/search/internal/store"
)

// Los mismos casos que prueba localeForRequest en packages/contracts (locale.test.ts).
func TestLocaleCasesShared(t *testing.T) {
	raw, err := os.ReadFile("../../../../packages/contracts/src/locale-cases.json")
	if err != nil {
		t.Fatal(err)
	}
	var data struct {
		Origins Origins `json:"origins"`
		Cases   []struct {
			Host      *string `json:"host"`
			AppLocale *string `json:"appLocale"`
			Mobile    bool    `json:"mobile"`
			Expected  string  `json:"expected"`
		} `json:"cases"`
	}
	if err := json.Unmarshal(raw, &data); err != nil {
		t.Fatal(err)
	}
	for _, c := range data.Cases {
		host, app := "", ""
		if c.Host != nil {
			host = *c.Host
		}
		if c.AppLocale != nil {
			app = *c.AppLocale
		}
		if got := LocaleForRequest(host, app, c.Mobile, data.Origins); got != c.Expected {
			t.Errorf("host=%q app=%q mobile=%v: %s, se esperaba %s", host, app, c.Mobile, got, c.Expected)
		}
	}
}

func codes(errs []FieldError) map[string]string {
	out := map[string]string{}
	for _, e := range errs {
		out[e.Field] = e.Code
	}
	return out
}

func TestParseQuery(t *testing.T) {
	ok := []string{"", "q=sillas", "categories=dj,venue,dj", "lat=18.9&lng=-99.2&radiusKm=50&sort=distance", "limit=50"}
	for _, raw := range ok {
		values, _ := url.ParseQuery(raw)
		if _, errs := ParseQuery(values, "es"); len(errs) > 0 {
			t.Errorf("%q: %v", raw, errs)
		}
	}
	values, _ := url.ParseQuery("categories=dj,venue,dj&lat=18.9&lng=-99.2")
	q, _ := ParseQuery(values, "es")
	if len(q.Categories) != 2 || q.RadiusKm != 30 || q.Limit != 20 || q.Sort != "relevance" {
		t.Errorf("valores por defecto o duplicados: %+v", q)
	}
	bad := map[string]map[string]string{
		"x=1":                           {"x": "unknown_field"},
		"q=" + strings.Repeat("a", 101): {"q": "too_long"},
		"categories=pirotecnia":         {"categories": "invalid_category"},
		"lat=91&lng=0":                  {"lat": "out_of_range"},
		"lat=18":                        {"lng": "required"},
		"radiusKm=10":                   {"radiusKm": "required"},
		"lat=1&lng=1&radiusKm=201":      {"radiusKm": "out_of_range"},
		"sort=distance":                 {"sort": "required"},
		"sort=precio":                   {"sort": "invalid_value"},
		"limit=0":                       {"limit": "out_of_range"},
		"limit=51":                      {"limit": "out_of_range"},
		"cursor=nope":                   {"cursor": "invalid_format"},
		"q=a&q=b":                       {"q": "invalid_format"},
		"lat=NaN&lng=1":                 {"lat": "out_of_range"},
	}
	for raw, want := range bad {
		values, _ := url.ParseQuery(raw)
		_, errs := ParseQuery(values, "es")
		got := codes(errs)
		for field, code := range want {
			if got[field] != code {
				t.Errorf("%q: %s=%q, se esperaba %q (%v)", raw, field, got[field], code, errs)
			}
		}
	}
}

func TestMessagesInEveryLocale(t *testing.T) {
	values, _ := url.ParseQuery("limit=99")
	seen := map[string]bool{}
	for _, l := range catalog.Data.Locales {
		_, errs := ParseQuery(values, l.Code)
		msg := errs[0].Message
		if strings.Contains(msg, "{{") || strings.HasPrefix(msg, "search.") || seen[msg] {
			t.Errorf("%s: mensaje sin traducir o repetido: %q", l.Code, msg)
		}
		seen[msg] = true
	}
}

func TestCursorRoundTrip(t *testing.T) {
	c := store.Cursor{Value: 0.123456789012345, ID: "0190f3c2-8d6b-7c1e-9a2b-3c4d5e6f7a8b"}
	got, ok := DecodeCursor(EncodeCursor(c, "relevance"), "relevance")
	if !ok || got != c {
		t.Fatalf("%+v %v", got, ok)
	}
	if _, ok := DecodeCursor(EncodeCursor(c, "relevance"), "distance"); ok {
		t.Error("un cursor de otro orden no vale")
	}
	if _, ok := DecodeCursor(EncodeCursor(store.Cursor{ID: "1 OR 1=1"}, "relevance"), "relevance"); ok {
		t.Error("un id que no es UUID no vale")
	}
}

func TestCategoriesMatching(t *testing.T) {
	for q, want := range map[string]string{"sillas": "furniture-rental", "Stühle": "furniture-rental", "pastel": "bakery", "DJ para boda": "dj", "fotografía": "photo-video"} {
		found := catalog.CategoriesMatching(q)
		if !contains(found, want) {
			t.Errorf("%q: %v no incluye %s", q, found, want)
		}
	}
	if found := catalog.CategoriesMatching("xy"); len(found) != 0 {
		t.Errorf("menos de 3 letras no busca categorías: %v", found)
	}
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

func TestLimiter(t *testing.T) {
	l := newLimiter(2, time.Second)
	now := time.Now()
	if ok, _ := l.allow("1.1.1.1", now); !ok {
		t.Fatal()
	}
	l.allow("1.1.1.1", now)
	if ok, retry := l.allow("1.1.1.1", now); ok || retry < 1 {
		t.Errorf("la tercera debe esperar: %v %d", ok, retry)
	}
	if ok, _ := l.allow("2.2.2.2", now); !ok {
		t.Error("otra IP tiene su propio límite")
	}
	if ok, _ := l.allow("1.1.1.1", now.Add(time.Second)); !ok {
		t.Error("la ventana se renueva")
	}
}

type fake struct{ err error }

func (f fake) Search(context.Context, store.Query) ([]store.Card, *store.Cursor, map[string]int, error) {
	return nil, nil, map[string]int{}, f.err
}

func server(f fake) http.Handler {
	return New(Config{
		Origins:        Origins{"es": "https://tuevento.fun", "en": "https://yourevent.fun"},
		AllowedOrigins: []string{"capacitor://localhost"},
		RateLimit:      3, RateWindow: time.Minute, Log: slog.New(slog.NewJSONHandler(io.Discard, nil)), SearchStore: f,
	})
}

func get(h http.Handler, path string, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(http.MethodGet, path, nil)
	r.Host = "yourevent.fun"
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestHandler(t *testing.T) {
	h := server(fake{})
	w := get(h, "/api/search/providers?q=dj", map[string]string{"X-Real-IP": "10.0.0.1"})
	if w.Code != 200 || w.Header().Get("Cache-Control") != "public, max-age=60" || !strings.Contains(w.Body.String(), `"items":[]`) {
		t.Errorf("%d %s", w.Code, w.Body)
	}
	// Problem Details en el idioma de la página (pt en el dominio inglés)
	w = get(h, "/api/search/providers?limit=0", map[string]string{"X-Real-IP": "10.0.0.2", "X-App-Locale": "pt"})
	var p Problem
	_ = json.Unmarshal(w.Body.Bytes(), &p)
	if w.Code != 400 || w.Header().Get("Content-Type") != "application/problem+json" || p.Code != "bad_request" ||
		p.Errors[0].Field != "limit" || p.Detail != catalog.T("pt", "search.invalidLimit", map[string]string{"max": "50"}) || p.RequestID == "" {
		t.Errorf("%d %+v", w.Code, p)
	}
	// 429 con Retry-After, por IP real
	for i := 0; i < 3; i++ {
		get(h, "/api/search/providers", map[string]string{"X-Real-IP": "10.0.0.3"})
	}
	w = get(h, "/api/search/providers", map[string]string{"X-Real-IP": "10.0.0.3"})
	if w.Code != 429 || w.Header().Get("Retry-After") == "" {
		t.Errorf("%d %v", w.Code, w.Header())
	}
	// La base de datos caída no filtra detalles
	w = get(server(fake{err: errors.New("pq: password authentication failed")}), "/api/search/providers", nil)
	if w.Code != 503 || strings.Contains(w.Body.String(), "password") {
		t.Errorf("%d %s", w.Code, w.Body)
	}
	// CORS solo para los orígenes permitidos, y sin cookies
	w = get(h, "/api/search/providers", map[string]string{"X-Real-IP": "10.0.0.4", "Origin": "capacitor://localhost"})
	if w.Header().Get("Access-Control-Allow-Origin") != "capacitor://localhost" || w.Header().Get("Access-Control-Allow-Credentials") != "" ||
		w.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("%v", w.Header())
	}
	w = get(h, "/api/search/providers", map[string]string{"X-Real-IP": "10.0.0.4", "Origin": "https://malo.example"})
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("origen no permitido: %v", w.Header())
	}
	if w := get(h, "/api/search/nada", nil); w.Code != 404 {
		t.Errorf("ruta desconocida: %d", w.Code)
	}
	r := httptest.NewRequest(http.MethodPost, "/api/search/providers", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, r)
	if rec.Code != 405 || rec.Header().Get("Allow") != "GET, OPTIONS" || !strings.Contains(rec.Body.String(), `"code":"bad_request"`) {
		t.Errorf("POST: %d %v", rec.Code, rec.Header())
	}
	if w := get(h, "/healthz", nil); w.Code != 200 {
		t.Errorf("healthz: %d", w.Code)
	}
}

func TestReportOnStoreFailure(t *testing.T) {
	var reported []string
	h := New(Config{
		Origins:   Origins{"es": "https://tuevento.fun", "en": "https://yourevent.fun"},
		RateLimit: 3, RateWindow: time.Minute, Log: slog.New(slog.NewJSONHandler(io.Discard, nil)),
		SearchStore: fake{err: errors.New("timeout")},
		Report:      func(err error, requestID string) { reported = append(reported, err.Error()+" "+requestID) },
	})
	get(h, "/api/search/providers", map[string]string{"X-Request-ID": "prueba-1234"})
	if len(reported) != 1 || reported[0] != "timeout prueba-1234" {
		t.Errorf("el fallo de la base de datos va a Bugsink con su requestId: %v", reported)
	}
	// Una petición inválida (4xx) no se reporta
	get(h, "/api/search/providers?limit=0", nil)
	if len(reported) != 1 {
		t.Errorf("los 4xx no se reportan: %v", reported)
	}
}
