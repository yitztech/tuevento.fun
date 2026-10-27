package api

import (
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/yitztech/tuevento.fun/services/search/internal/catalog"
	"github.com/yitztech/tuevento.fun/services/search/internal/store"
)

// FieldError es un error de un parámetro, con su mensaje ya traducido (AGENTS.md §22).
type FieldError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
}

var known = map[string]bool{"q": true, "categories": true, "lat": true, "lng": true, "radiusKm": true, "sort": true, "limit": true, "cursor": true}

// ParseQuery valida la consulta en lista blanca: un parámetro desconocido, repetido o fuera de
// rango responde 400 con un error por campo.
func ParseQuery(values url.Values, locale string) (store.Query, []FieldError) {
	limits := catalog.Data.SearchLimits
	q := store.Query{Limit: limits.DefaultLimit, Sort: "relevance"}
	var errs []FieldError
	fail := func(field, code, key string, vars map[string]string) {
		errs = append(errs, FieldError{Field: field, Code: code, Message: catalog.T(locale, key, vars)})
	}
	for name, list := range values {
		if !known[name] {
			fail(name, "unknown_field", "search.unknownParameter", map[string]string{"name": name})
		} else if len(list) > 1 {
			fail(name, "invalid_format", "problems.badRequest", nil)
		}
	}
	get := func(name string) string { return strings.TrimSpace(values.Get(name)) }

	q.Text = strings.Join(strings.Fields(get("q")), " ")
	if utf8.RuneCountInString(q.Text) > catalog.Data.AccountLimits.Search {
		fail("q", "too_long", "search.tooLong", map[string]string{"max": strconv.Itoa(catalog.Data.AccountLimits.Search)})
	}
	if raw := get("categories"); raw != "" {
		seen := map[string]bool{}
		for _, code := range strings.Split(raw, ",") {
			code = strings.TrimSpace(code)
			if !catalog.IsCategory(code) {
				fail("categories", "invalid_category", "validation.invalidCategory", nil)
				break
			}
			if !seen[code] {
				seen[code] = true
				q.Categories = append(q.Categories, code)
			}
		}
	}
	number := func(name string, min, max float64) (float64, bool) {
		raw := get(name)
		if raw == "" {
			return 0, false
		}
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil || v < min || v > max || v != v {
			fail(name, "out_of_range", "validation.invalidCoordinates", nil)
			return 0, false
		}
		return v, true
	}
	lat, hasLat := number("lat", -90, 90)
	lng, hasLng := number("lng", -180, 180)
	if hasLat && hasLng {
		q.Point = &store.Point{Lat: lat, Lng: lng}
		q.RadiusKm = float64(limits.DefaultRadiusKm)
	} else if latRaw, lngRaw := get("lat"), get("lng"); (latRaw == "") != (lngRaw == "") {
		// Solo falta la otra si de verdad no llegó (una no válida ya tiene su error)
		fail(map[bool]string{true: "lat", false: "lng"}[latRaw == ""], "required", "search.needsPoint", nil)
	}
	if raw := get("radiusKm"); raw != "" {
		r, err := strconv.Atoi(raw)
		switch {
		case err != nil || r < 1 || r > limits.MaxRadiusKm:
			fail("radiusKm", "out_of_range", "search.invalidRadius", map[string]string{"max": strconv.Itoa(limits.MaxRadiusKm)})
		case q.Point == nil:
			fail("radiusKm", "required", "search.needsPoint", nil)
		default:
			q.RadiusKm = float64(r)
		}
	}
	if raw := get("sort"); raw != "" {
		switch {
		case raw != "relevance" && raw != "distance":
			fail("sort", "invalid_value", "search.invalidSort", nil)
		case raw == "distance" && q.Point == nil:
			fail("sort", "required", "search.needsPoint", nil)
		default:
			q.Sort = raw
		}
	}
	if raw := get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > limits.MaxLimit {
			fail("limit", "out_of_range", "search.invalidLimit", map[string]string{"max": strconv.Itoa(limits.MaxLimit)})
		} else {
			q.Limit = n
		}
	}
	if raw := get("cursor"); raw != "" {
		c, ok := DecodeCursor(raw, q.Sort)
		if !ok {
			fail("cursor", "invalid_format", "search.invalidCursor", nil)
		} else {
			q.After = &c
		}
	}
	q.Boost = catalog.CategoriesMatching(q.Text)
	return q, errs
}
